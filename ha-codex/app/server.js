'use strict';

const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const { URL } = require('url');

const HOST = '0.0.0.0';
const PORT = Number(process.env.PORT || 8099);
const SUPERVISOR_TOKEN = process.env.SUPERVISOR_TOKEN;
const APP_VERSION = process.env.BUILD_VERSION || process.env.APP_VERSION || '0.1.1';
const CONFIG_DIR = '/config';
const OPTIONS_FILE = '/data/options.json';
const WEB_DIR = path.join(__dirname, 'web');

const DEFAULT_OPTIONS = {
  debug: false,
  max_entities: 250,
  allow_test_write: false,
  test_write_filename: 'ha_codex_test.txt'
};

/**
 * TODO(phase-2): Add /api/codex/plan as read-only planning endpoint.
 * TODO(phase-2): Add explicit role checks before any non-test mutation endpoint.
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

function isLikelyIngress(req) {
  return Boolean(req.headers['x-ingress-path'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress);
}

function sanitizeFilename(name) {
  const safe = (name || '').replace(/[^a-zA-Z0-9._-]/g, '_');
  return safe.length ? safe : 'ha_codex_test.txt';
}

function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

async function loadOptions() {
  try {
    const raw = await fs.readFile(OPTIONS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      debug: Boolean(parsed.debug),
      max_entities: clamp(parsed.max_entities, 10, 2000, DEFAULT_OPTIONS.max_entities),
      allow_test_write: Boolean(parsed.allow_test_write),
      test_write_filename: sanitizeFilename(parsed.test_write_filename || DEFAULT_OPTIONS.test_write_filename)
    };
  } catch {
    return { ...DEFAULT_OPTIONS };
  }
}

async function fetchHaJson(corePath) {
  if (!SUPERVISOR_TOKEN) {
    const err = new Error('SUPERVISOR_TOKEN is not set');
    err.status = 500;
    throw err;
  }

  const response = await fetch(`http://supervisor/core/api${corePath}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${SUPERVISOR_TOKEN}`,
      Accept: 'application/json'
    }
  });

  const bodyText = await response.text();
  let body = {};
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    body = { raw: bodyText };
  }

  if (!response.ok) {
    const err = new Error(`Home Assistant API failed (${response.status})`);
    err.status = response.status;
    err.details = body;
    throw err;
  }

  return body;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const err = new Error('Request body must be valid JSON');
    err.status = 400;
    throw err;
  }
}

async function handleApi(req, res, pathname) {
  if (!isLikelyIngress(req)) {
    return json(res, 403, { ok: false, error: 'forbidden', message: 'Ingress headers missing.' });
  }

  const options = await loadOptions();

  if (pathname === '/api/ping' && req.method === 'GET') {
    return json(res, 200, {
      ok: true,
      message: 'pong',
      version: APP_VERSION,
      timestamp: new Date().toISOString()
    });
  }

  if (pathname === '/api/options' && req.method === 'GET') {
    return json(res, 200, { ok: true, version: APP_VERSION, data: options });
  }

  if (pathname === '/api/config' && req.method === 'GET') {
    const config = await fetchHaJson('/config');
    return json(res, 200, { ok: true, data: config });
  }

  if (pathname === '/api/entities' && req.method === 'GET') {
    const states = await fetchHaJson('/states');
    const entityArray = Array.isArray(states) ? states : [];
    const slim = entityArray.slice(0, options.max_entities).map((entity) => ({
      entity_id: entity.entity_id,
      state: entity.state,
      last_changed: entity.last_changed,
      friendly_name: entity.attributes?.friendly_name || null
    }));

    return json(res, 200, {
      ok: true,
      total: entityArray.length,
      returned: slim.length,
      max_entities: options.max_entities,
      data: slim
    });
  }

  if (pathname === '/api/files' && req.method === 'GET') {
    const entries = await fs.readdir(CONFIG_DIR, { withFileTypes: true });
    const safe = entries.map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other'
    }));

    safe.sort((a, b) => a.name.localeCompare(b.name));

    return json(res, 200, { ok: true, path: CONFIG_DIR, count: safe.length, data: safe });
  }

  if (pathname === '/api/test/write' && req.method === 'POST') {
    if (!options.allow_test_write) {
      return json(res, 403, {
        ok: false,
        error: 'forbidden',
        message: 'Test write endpoint is disabled. Enable allow_test_write in add-on options.'
      });
    }

    const body = await readBody(req);
    const note = typeof body.note === 'string' ? body.note.slice(0, 500) : 'manual test';
    const targetFile = path.join(CONFIG_DIR, sanitizeFilename(options.test_write_filename));
    const content = `HA Codex test write\n${new Date().toISOString()}\n${note}\n`;

    await fs.writeFile(targetFile, content, 'utf8');

    return json(res, 200, {
      ok: true,
      message: 'Test file written successfully.',
      path: targetFile
    });
  }

  return json(res, 404, { ok: false, error: 'not_found', message: `Unknown endpoint: ${pathname}` });
}

async function serveStatic(req, res, pathname) {
  const normalized = pathname === '/' ? '/index.html' : pathname;
  const requested = path.normalize(path.join(WEB_DIR, normalized));

  if (!requested.startsWith(WEB_DIR)) {
    return json(res, 400, { ok: false, error: 'bad_request', message: 'Invalid static path.' });
  }

  try {
    const data = await fs.readFile(requested);
    res.writeHead(200, { 'Content-Type': guessContentType(requested) });
    res.end(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return json(res, 404, { ok: false, error: 'not_found', message: `Static file not found: ${normalized}` });
    }

    return json(res, 500, {
      ok: false,
      error: 'server_error',
      message: 'Static asset error.',
      details: err.message
    });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (reqUrl.pathname.startsWith('/api/')) {
      await handleApi(req, res, reqUrl.pathname);
      return;
    }

    await serveStatic(req, res, reqUrl.pathname);
  } catch (err) {
    const status = Number(err.status) || 500;
    json(res, status, {
      ok: false,
      error: status >= 500 ? 'server_error' : 'request_error',
      message: err.message,
      details: err.details || null
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`HA Codex server listening on ${HOST}:${PORT}`);
});
