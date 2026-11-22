'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.resolve(__dirname, 'public');
const startedAt = Date.now();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(payload, null, 2));
}

function megabytes(bytes) {
  return Math.round(bytes / (1024 * 1024));
}

function getSystemInfo() {
  const hostTotal = os.totalmem();
  const hostFree = os.freemem();
  const processMemory = process.memoryUsage();

  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    platform: os.platform(),
    arch: os.arch(),
    hostMemory: {
      totalMb: megabytes(hostTotal),
      usedMb: megabytes(hostTotal - hostFree),
      freeMb: megabytes(hostFree),
    },
    processMemory: {
      rssMb: megabytes(processMemory.rss),
      heapUsedMb: megabytes(processMemory.heapUsed),
      heapTotalMb: megabytes(processMemory.heapTotal),
    },
    loadAverage: os.loadavg().map((value) => Number(value.toFixed(2))),
  };
}

function resolvePublicFile(requestPath) {
  let decodedPath;

  try {
    decodedPath = decodeURIComponent(requestPath);
  } catch {
    return null;
  }

  const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
  const absolutePath = path.resolve(PUBLIC_DIR, relativePath);

  if (absolutePath !== PUBLIC_DIR && !absolutePath.startsWith(PUBLIC_DIR + path.sep)) {
    return null;
  }

  return absolutePath;
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const pathname = requestUrl.pathname;

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Method Not Allowed');
    return;
  }

  if (pathname === '/api/health') {
    sendJson(response, 200, {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      processStartedAt: new Date(startedAt).toISOString(),
    });
    return;
  }

  if (pathname === '/api/system') {
    sendJson(response, 200, getSystemInfo());
    return;
  }

  const filePath = resolvePublicFile(pathname);
  if (!filePath) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Bad Request');
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not Found');
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
      'Content-Length': stats.size,
      'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'SAMEORIGIN',
    });

    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      if (!response.headersSent) response.writeHead(500);
      response.end('Internal Server Error');
    });
    stream.pipe(response);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`SteamGlass server listening on http://${HOST}:${PORT}`);
});

function shutdown(signal) {
  console.log(`\n${signal}: shutting down SteamGlass server...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
