var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_config = require("dotenv/config");
var import_express = __toESM(require("express"), 1);
var import_http = __toESM(require("http"), 1);
var import_https = __toESM(require("https"), 1);
var import_os = __toESM(require("os"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
function getLanAddresses() {
  const addrs = [];
  for (const interfaces of Object.values(import_os.default.networkInterfaces())) {
    for (const net of interfaces ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        addrs.push(net.address);
      }
    }
  }
  return addrs;
}
var app = (0, import_express.default)();
var PORT = process.env.PORT ? parseInt(process.env.PORT) : 3e3;
var isProd = process.env.NODE_ENV === "production";
function resolveBackendUrl() {
  const url = process.env.BACKEND_URL?.trim().replace(/\/$/, "");
  if (url) return url;
  if (!isProd) return "http://localhost:3001";
  console.warn("BACKEND_URL is not set \u2014 /api proxy disabled in production.");
  return "";
}
var BACKEND_URL = resolveBackendUrl();
function pingBackend(backendUrl) {
  const target = new URL(backendUrl);
  const transport = target.protocol === "https:" ? import_https.default : import_http.default;
  const defaultPort = target.protocol === "https:" ? 443 : 80;
  const req = transport.request(
    {
      hostname: target.hostname,
      port: target.port || defaultPort,
      path: "/api/health",
      method: "GET",
      timeout: 3e3
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
      `Backend API: not reachable at ${backendUrl}
  Start it in another terminal: cd backend && npm run start:dev`
    );
  });
  req.on("timeout", () => {
    req.destroy();
    console.warn(
      `Backend API: timed out connecting to ${backendUrl}
  Start it in another terminal: cd backend && npm run start:dev`
    );
  });
  req.end();
}
function createApiProxy(backendUrl) {
  const target = new URL(backendUrl);
  const transport = target.protocol === "https:" ? import_https.default : import_http.default;
  const defaultPort = target.protocol === "https:" ? 443 : 80;
  return (req, res) => {
    const proxyReq = transport.request(
      {
        hostname: target.hostname,
        port: target.port || defaultPort,
        path: req.originalUrl,
        method: req.method,
        headers: { ...req.headers, host: target.host }
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
          error: "Backend API unavailable. Ensure the NestJS server is running."
        });
      }
    });
    req.pipe(proxyReq);
  };
}
async function startServer() {
  const isDev = !isProd;
  app.get("/favicon.ico", (_req, res) => {
    res.redirect(302, "/favicon.svg");
  });
  if (BACKEND_URL) {
    app.use("/api", createApiProxy(BACKEND_URL));
  }
  const httpServer = import_http.default.createServer(app);
  if (isDev) {
    console.log("Starting Flex HRM frontend in development mode...");
    const vite = await (0, import_vite.createServer)({
      server: {
        middlewareMode: true,
        hmr: { server: httpServer },
        host: true,
        allowedHosts: true,
        proxy: BACKEND_URL ? {
          "/api": {
            target: BACKEND_URL,
            changeOrigin: true
          }
        } : void 0
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting Flex HRM frontend in production mode...");
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath, { index: "index.html" }));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
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
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
//# sourceMappingURL=server.cjs.map
