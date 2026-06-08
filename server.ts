/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import "dotenv/config";
import express from "express";
import http from "http";
import https from "https";
import path from "path";
import type { Request, Response } from "express";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const isProd = process.env.NODE_ENV === "production";

function resolveBackendUrl(): string {
  const url = process.env.BACKEND_URL?.trim().replace(/\/$/, "");
  if (url) return url;
  const hint = isProd
    ? "Set BACKEND_URL for the Express /api proxy, PUBLIC_API_URL for a public API host, or use a reverse proxy for same-origin /api."
    : "Set BACKEND_URL in frontend/.env for local development.";
  console.warn(`BACKEND_URL is not set — /api proxy disabled. ${hint}`);
  return "";
}

const BACKEND_URL = resolveBackendUrl();

/** Browser-facing API origin. BACKEND_URL is server-side proxy only and is not exposed. */
function getPublicApiBase(): string {
  return process.env.PUBLIC_API_URL?.trim().replace(/\/$/, "") ?? "";
}

function createApiProxy(backendUrl: string) {
  const target = new URL(backendUrl);
  const transport = target.protocol === "https:" ? https : http;
  const defaultPort = target.protocol === "https:" ? 443 : 80;

  return (req: Request, res: Response) => {
    const proxyReq = transport.request(
      {
        hostname: target.hostname,
        port: target.port || defaultPort,
        path: req.originalUrl,
        method: req.method,
        headers: { ...req.headers, host: target.host },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );

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

async function startServer() {
  const isDev = !isProd;

  app.get("/runtime-config.js", (_req, res) => {
    const apiBase = getPublicApiBase();
    res.type("application/javascript");
    res.send(`window.__FLEXHRM_API_BASE__=${JSON.stringify(apiBase)};`);
  });

  app.get("/favicon.ico", (_req, res) => {
    res.redirect(302, "/favicon.svg");
  });

  if (BACKEND_URL) {
    app.use("/api", createApiProxy(BACKEND_URL));
  }

  if (isDev) {
    console.log("Starting Flex HRM frontend in development mode...");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
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
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Flex HRM UI running on port ${PORT}`);
    if (BACKEND_URL) {
      console.log(`API proxy target: ${BACKEND_URL}`);
    }
    const publicApiBase = getPublicApiBase();
    if (publicApiBase) {
      console.log(`Browser API base: ${publicApiBase}`);
    } else {
      console.log("Browser API base: same-origin (/api proxy)");
    }
  });
}

startServer();
