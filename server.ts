/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import "dotenv/config";
import compression from "compression";
import express from "express";
import fs from "fs";
import http from "http";
import https from "https";
import os from "os";
import path from "path";
import type { Request, Response } from "express";
import { createServer as createViteServer } from "vite";

function getLanAddresses(): string[] {
  const addrs: string[] = [];
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const net of interfaces ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        addrs.push(net.address);
      }
    }
  }
  return addrs;
}

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const isProd = process.env.NODE_ENV === "production";

function resolveBackendUrl(): string {
  const url = process.env.BACKEND_URL?.trim().replace(/\/$/, "");
  if (url) return url;
  if (!isProd) return "http://localhost:3001";
  console.warn("BACKEND_URL is not set — /api proxy disabled in production.");
  return "";
}

const BACKEND_URL = resolveBackendUrl();

function pingBackend(backendUrl: string) {
  const target = new URL(backendUrl);
  const transport = target.protocol === "https:" ? https : http;
  const defaultPort = target.protocol === "https:" ? 443 : 80;
  const req = transport.request(
    {
      hostname: target.hostname,
      port: target.port || defaultPort,
      path: "/api/health",
      method: "GET",
      timeout: 3000,
    },
    (res) => {
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
        console.log("Backend API: reachable");
      } else {
        console.warn(`Backend API: responded with HTTP ${res.statusCode}`);
      }
      res.resume();
    }
  );
  req.on("error", () => {
    console.warn(
      `Backend API: not reachable at ${backendUrl}\n` +
        "  Start it in another terminal: cd backend && npm run start:dev"
    );
  });
  req.on("timeout", () => {
    req.destroy();
    console.warn(
      `Backend API: timed out connecting to ${backendUrl}\n` +
        "  Start it in another terminal: cd backend && npm run start:dev"
    );
  });
  req.end();
}

function createApiProxy(backendUrl: string) {
  const target = new URL(backendUrl);
  const transport = target.protocol === "https:" ? https : http;
  const defaultPort = target.protocol === "https:" ? 443 : 80;

  return (req: Request, res: Response) => {
    const isBulkResolve =
      typeof req.originalUrl === "string" &&
      (req.originalUrl.includes("/bulk-assign-village-locations") ||
        req.originalUrl.includes("/bulk-resolve-locations"));
    // Bulk resolve can take ~16s/school; give local proxy enough headroom.
    const proxyTimeoutMs = isBulkResolve ? 120_000 : 60_000;

    const proxyReq = transport.request(
      {
        hostname: target.hostname,
        port: target.port || defaultPort,
        path: req.originalUrl,
        method: req.method,
        headers: { ...req.headers, host: target.host },
        timeout: proxyTimeoutMs,
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );

    proxyReq.on("timeout", () => {
      proxyReq.destroy();
      if (!res.headersSent) {
        res.status(504).json({
          message:
            "API proxy timed out waiting for the backend. For Pin & Resolve, retry one school at a time.",
          error: "Gateway Timeout",
          statusCode: 504,
        });
      }
    });

    proxyReq.on("error", (err) => {
      console.error("[API proxy]", err.message);
      if (!res.headersSent) {
        res.status(502).json({
          error: "Backend API unavailable. Ensure the NestJS server is running.",
        });
      }
    });

    req.pipe(proxyReq);
  };
}

function resolveFaviconPath(distPath: string): string {
  const publicFavicon = path.join(process.cwd(), "public", "favicon.svg");
  if (!isProd && fs.existsSync(publicFavicon)) return publicFavicon;
  const distFavicon = path.join(distPath, "favicon.svg");
  if (fs.existsSync(distFavicon)) return distFavicon;
  return publicFavicon;
}

function staticCacheHeaders(res: Response, filePath: string): void {
  if (filePath.endsWith(".html")) {
    res.setHeader("Cache-Control", "no-cache");
    return;
  }
  if (filePath.includes(`${path.sep}assets${path.sep}`)) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return;
  }
  res.setHeader("Cache-Control", "public, max-age=86400");
}

async function startServer() {
  const isDev = !isProd;
  const distPath = path.join(process.cwd(), "dist");

  app.use(compression());

  app.get("/favicon.ico", (_req, res) => {
    res.type("image/svg+xml");
    res.sendFile(resolveFaviconPath(distPath));
  });

  if (BACKEND_URL) {
    app.use("/api", createApiProxy(BACKEND_URL));
  }

  const httpServer = http.createServer(app);

  if (isDev) {
    console.log("Starting Flex HRM frontend in development mode...");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server: httpServer },
        host: true,
        allowedHosts: true,
        proxy: BACKEND_URL
          ? {
              "/api": {
                target: BACKEND_URL,
                changeOrigin: true,
              },
            }
          : undefined,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting Flex HRM frontend in production mode...");
    app.use(
      express.static(distPath, {
        index: false,
        setHeaders: staticCacheHeaders,
      }),
    );
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Flex HRM UI running on port ${PORT}`);
    if (BACKEND_URL) {
      console.log(`API proxy target: ${BACKEND_URL}`);
      pingBackend(BACKEND_URL);
    }
    if (isDev) {
      console.log("Browser API base: same-origin (/api proxy)");
      console.log(`Desktop:  http://localhost:${PORT}/supervisor/login`);
      for (const ip of getLanAddresses()) {
        console.log(`Phone:    http://${ip}:${PORT}/supervisor/login`);
      }
    }
  });
}

startServer();
