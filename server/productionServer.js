/* ==========================================================================
   MACHII MENS MART — STANDALONE PRODUCTION SERVER
   Zero-dependency Node.js production server for hosting platforms:
   - Serves Vite production build from dist/
   - Connects all backend APIs, payment, tracking, and notification routes
   - Provides /health and /api/health monitoring endpoints
   - Injects production security headers (HSTS, nosniff, SAMEORIGIN)
   - SPA fallback routing (serves dist/index.html on unmapped client routes)
   - Graceful shutdown handling (SIGTERM, SIGINT)
   ========================================================================== */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import viteConfig from '../vite.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.resolve(ROOT_DIR, 'dist');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

// Extract orderApiPlugin middlewares from vite.config.js
const configObj = typeof viteConfig === 'function' ? viteConfig({ command: 'serve', mode: 'production' }) : viteConfig;
const apiPlugin = configObj.plugins.find((p) => p && (p.name === 'machii-order-backend-api' || p.name === 'order-api-plugin'));

const registeredMiddlewares = [];
const fakeViteServer = {
  middlewares: {
    use(routeOrHandler, maybeHandler) {
      if (typeof routeOrHandler === 'string' && typeof maybeHandler === 'function') {
        registeredMiddlewares.push({ prefix: routeOrHandler, handler: maybeHandler });
      } else if (typeof routeOrHandler === 'function') {
        registeredMiddlewares.push({ prefix: null, handler: routeOrHandler });
      }
    },
  },
};

if (apiPlugin && apiPlugin.configureServer) {
  apiPlugin.configureServer(fakeViteServer);
}

// Production Request Handler
function requestHandler(req, res) {
  // 1. Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  const isHttps = req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted;
  if (isHttps) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // 2. Dispatch API & Backend Middlewares
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  let middlewareIndex = 0;
  function runNextMiddleware() {
    while (middlewareIndex < registeredMiddlewares.length) {
      const entry = registeredMiddlewares[middlewareIndex++];
      if (!entry.prefix || pathname === entry.prefix || pathname.startsWith(entry.prefix + '/')) {
        return entry.handler(req, res, runNextMiddleware);
      }
    }

    // 3. Static File Serving from dist/
    serveStaticFile(req, res, pathname);
  }

  runNextMiddleware();
}

function serveStaticFile(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  // Sanitize path to prevent directory traversal
  let safePath = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\|/])+/g, '');
  if (safePath === '/' || safePath === '\\') {
    safePath = '/index.html';
  }

  let filePath = path.join(DIST_DIR, safePath);

  // If path is a directory, check for index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // If file doesn't exist, fallback to dist/index.html (SPA client-side routing)
  if (!fs.existsSync(filePath)) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Not Found. Please run npm run build first.');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  // Caching policy:
  // Hashed assets in /assets/ -> Cache for 1 year immutable
  // HTML documents & root files -> No-cache, revalidate
  if (filePath.includes(`${path.sep}assets${path.sep}`)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  }

  res.setHeader('Content-Type', contentType);

  // Support Gzip compression for text-based assets
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const canGzip = /\bgzip\b/.test(acceptEncoding) && /text|javascript|json|xml|svg/.test(contentType);

  if (req.method === 'HEAD') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const rawStream = fs.createReadStream(filePath);
  if (canGzip) {
    res.setHeader('Content-Encoding', 'gzip');
    const gzip = zlib.createGzip({ level: 6 });
    rawStream.pipe(gzip).pipe(res);
  } else {
    rawStream.pipe(res);
  }
}

// Create and start production HTTP server
const server = http.createServer(requestHandler);

export function startServer(port = PORT, host = HOST) {
  return new Promise((resolve, reject) => {
    server.listen(port, host, () => {
      console.log(`\n=============================================================`);
      console.log(`MACHII MENS MART — PRODUCTION SERVER RUNNING`);
      console.log(`Port: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/`);
      console.log(`Health Check: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/health`);
      console.log(`Environment: ${process.env.NODE_ENV || 'production'}`);
      console.log(`=============================================================\n`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

// Handle termination signals cleanly
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: Closing Machii Mens Mart production server...');
  server.close(() => {
    console.log('Machii Mens Mart production server closed gracefully.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: Closing Machii Mens Mart production server...');
  server.close(() => {
    console.log('Machii Mens Mart production server closed gracefully.');
    process.exit(0);
  });
});

// Run directly if executed as main script
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  startServer().catch((err) => {
    console.error('Failed to start Machii production server:', err);
    process.exit(1);
  });
}

