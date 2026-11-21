#!/usr/bin/env node
'use strict';

/**
 * Servidor estatico minimo usado apenas para pre-visualizar a interface
 * num navegador (register_preview). A app real corre em Electron.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REQUESTED = Number(process.env.PREVIEW_PORT || process.env.PORT || 4321);
const PORT = Number.isFinite(REQUESTED) && REQUESTED > 0 ? REQUESTED : 4321;
const HOST = '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
};

function sendJson(res, code, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

/** Catalogo real, para a pre-visualizacao mostrar exatamente os mesmos tweaks. */
function catalog() {
  const svc = require(path.join(ROOT, 'src', 'main', 'services', 'tweaks.js'));
  return { categories: svc.CATEGORIES, tweaks: svc.list() };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);

  if (url.pathname === '/api/mock/catalog') {
    try {
      sendJson(res, 200, catalog());
    } catch (error) {
      sendJson(res, 500, { error: String(error) });
    }
    return;
  }

  if (url.pathname === '/') {
    res.writeHead(302, { Location: '/src/renderer/index.html' });
    res.end();
    return;
  }

  const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file = path.resolve(ROOT, relative);

  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }

  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`preview em http://${HOST}:${PORT}/src/renderer/index.html`);
});
