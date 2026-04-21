'use strict';

const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const { URL } = require('url');

const HOST = '0.0.0.0';
const PORT = Number(process.env.PORT || 8099);
const SUPERVISOR_TOKEN = process.env.SUPERVISOR_TOKEN;
const CONFIG_DIR = '/config';
const WEB_DIR = path.join(__dirname, 'web');

/**
 * TODO(phase-2): Add a Codex planning route family under /api/codex/*.
 * Keep all mutating endpoints isolated there and enforce explicit authz checks.
 */

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload, null, 2));
}

function guessContentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

function ingressRequestLikely(req) {
  // Keep checks permissive in v1, but validate obviously expected proxy patterns.
  const xForwardedFor = req.headers['x-forwarded-for'];
  const xIngressPath = req.headers['x-ingress-path'];
  return Boolean(xForwardedFor || xIngressPath || req.socket.remoteAddress);
}

async function fetchHaJson(corePath) {
  if (!SUPERVISOR_TOKEN) {
    const err = new Error('SUPERVISOR_TOKEN is not set');
    err.status = 500;
    throw err;
  }

  const url = `http://supervisor/core/api${corePath}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${SUPERVISOR_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  const body = await response.text();
  let parsed;
  try {
    parsed = body ? JSON.parse(body) : {};
  } catch {
    parsed = { raw: body };
  }

  if (!response.ok) {
    const err = new Error(`Home Assistant API request failed: ${response.status}`);
    err.status = response.status;
    err.details = parsed;
    throw err;
  }

  return parsed;
}

async function handleApi(req, res, pathname) {
  if (!ingressRequestLikely(req)) {
    return json(res, 403, {
      ok: false,
      error: 'forbidden',
      message: 'Ingress proxy headers are missing.'
    });
  }

  if (pathname === '/api/ping' && req.method === 'GET') {
    return json(res, 200, {
      ok: true,
      message: 'pong',
      timestamp: new Date().toISOString()
    });
  }

  if (pathname === '/api/config' && req.method === 'GET') {
    const config = await fetchHaJson('/config');
    return json(res, 200, { ok: true, data: config });
  }

  if (pathname === '/api/entities' && req.method === 'GET') {
    const states = await fetchHaJson('/states');
    const slim = Array.isArray(states)
      ? states.map((entity) => ({
          entity_id: entity.entity_id,
          state: entity.state,
          last_changed: entity.last_changed,
          friendly_name: entity.attributes?.friendly_name || null
        }))
      : [];

    return json(res, 200, {
      ok: true,
      count: slim.length,
      data: slim
    });
  }

  if (pathname === '/api/files' && req.method === 'GET') {
    const entries = await fs.readdir(CONFIG_DIR, { withFileTypes: true });
    const safeList = entries
      .map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other'
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return json(res, 200, {
      ok: true,
      path: CONFIG_DIR,
      count: safeList.length,
      data: safeList
    });
  }

  return json(res, 404, {
    ok: false,
    error: 'not_found',
    message: `Unknown endpoint: ${pathname}`
  });
}

async function serveStatic(req, res, pathname) {
  const normalized = pathname === '/' ? '/index.html' : pathname;
  const candidatePath = path.normalize(path.join(WEB_DIR, normalized));

  if (!candidatePath.startsWith(WEB_DIR)) {
    return json(res, 400, {
      ok: false,
      error: 'bad_request',
      message: 'Invalid static path.'
    });
  }

  try {
    const data = await fs.readFile(candidatePath);
    res.writeHead(200, { 'Content-Type': guessContentType(candidatePath) });
    res.end(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return json(res, 404, {
        ok: false,
        error: 'not_found',
        message: `File not found: ${normalized}`
      });
    }

    return json(res, 500, {
      ok: false,
      error: 'server_error',
      message: 'Failed to serve static asset.',
      details: err.message
    });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url.pathname);
      return;
    }

    await serveStatic(req, res, url.pathname);
  } catch (err) {
    const status = Number(err.status) || 500;
    json(res, status, {
      ok: false,
      error: status === 500 ? 'server_error' : 'request_error',
      message: err.message,
      details: err.details || null
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`HA Codex server listening on ${HOST}:${PORT}`);
});
