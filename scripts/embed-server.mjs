#!/usr/bin/env node
// Local dev-only embed server for the rubric engine.
// POST /embed { query, anchors } → { queryVector, anchorVectors }.
// Pre-warms rubric anchors at boot; disk-caches anchor vectors across restarts.
// Refuses to start under NODE_ENV=production.

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.NODE_ENV === 'production') {
  console.error('embed-server refuses to start under NODE_ENV=production');
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CACHE_DIR = join(ROOT, 'node_modules', '.cache');
const CACHE_FILE = join(CACHE_DIR, 'htxlabs-embedder.json');
const PORT = 8001;
const HOST = '127.0.0.1';
const MODEL = 'Xenova/multilingual-e5-small';

// --- Disk-persisted anchor cache ---
const cache = new Map();
let dirty = false;
let flushTimer = null;

async function loadCache() {
  try {
    const raw = await readFile(CACHE_FILE, 'utf8');
    const obj = JSON.parse(raw);
    for (const [k, v] of Object.entries(obj)) cache.set(k, v);
    console.log(`[cache] loaded ${cache.size} anchor embeddings from disk`);
  } catch {
    // No cache yet; start fresh.
  }
}

async function flushCache() {
  if (!dirty) return;
  await mkdir(CACHE_DIR, { recursive: true });
  const obj = Object.fromEntries(cache);
  await writeFile(CACHE_FILE, JSON.stringify(obj));
  dirty = false;
}

function scheduleFlush() {
  dirty = true;
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushCache().catch((e) => console.error('[cache] flush failed:', e));
  }, 2000);
}

// --- Anchor discovery: walk src/content/ for rubric JSON files ---
async function walk(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walk(p)));
    } else if (e.isFile() && p.endsWith('.json') && p.includes(`${sep}rubrics${sep}`)) {
      out.push(p);
    }
  }
  return out;
}

function collectAnchors(rubric) {
  const out = new Set();
  for (const c of rubric.criteria ?? []) {
    for (const check of c.any ?? []) {
      if (check.kind === 'semantic' && Array.isArray(check.anchors)) {
        for (const a of check.anchors) out.add(a);
      }
    }
  }
  return out;
}

async function discoverAnchors() {
  const contentDir = join(ROOT, 'src', 'content');
  let files;
  try {
    files = await walk(contentDir);
  } catch {
    return [];
  }
  const anchors = new Set();
  for (const f of files) {
    try {
      const raw = await readFile(f, 'utf8');
      const json = JSON.parse(raw);
      for (const a of collectAnchors(json)) anchors.add(a);
    } catch (e) {
      console.warn(`[discover] skipping ${f}: ${e?.message ?? e}`);
    }
  }
  return [...anchors];
}

// --- Embedder ---
let extractor = null;

async function loadModel() {
  console.log(`[model] loading ${MODEL}…`);
  const { pipeline } = await import('@huggingface/transformers');
  extractor = await pipeline('feature-extraction', MODEL);
  console.log('[model] loaded');
}

async function embed(texts) {
  if (!extractor) throw new Error('model not loaded');
  const out = await extractor(texts, { pooling: 'mean', normalize: true });
  return out.tolist();
}

async function embedQuery(query) {
  const vectors = await embed([`query: ${query}`]);
  return vectors[0];
}

async function embedAnchors(anchors) {
  const missing = [];
  for (const a of anchors) {
    if (!cache.has(a)) missing.push(a);
  }
  if (missing.length > 0) {
    const vectors = await embed(missing.map((a) => `passage: ${a}`));
    for (let i = 0; i < missing.length; i++) {
      cache.set(missing[i], vectors[i]);
    }
    scheduleFlush();
  }
  return anchors.map((a) => cache.get(a));
}

async function prewarm() {
  const anchors = await discoverAnchors();
  if (anchors.length === 0) {
    console.log('[prewarm] no rubric anchors found');
    return 0;
  }
  await embedAnchors(anchors);
  await flushCache();
  return anchors.length;
}

// --- HTTP server ---
function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }
  if (req.method !== 'POST' || req.url !== '/embed') {
    res.writeHead(404, corsHeaders());
    res.end();
    return;
  }
  try {
    const raw = await readBody(req);
    const { query, anchors } = JSON.parse(raw);
    if (typeof query !== 'string' || !Array.isArray(anchors)) {
      res.writeHead(400, { 'content-type': 'application/json', ...corsHeaders() });
      res.end(JSON.stringify({ error: 'expected { query: string, anchors: string[] }' }));
      return;
    }
    const [queryVector, anchorVectors] = await Promise.all([
      embedQuery(query),
      embedAnchors(anchors),
    ]);
    res.writeHead(200, { 'content-type': 'application/json', ...corsHeaders() });
    res.end(JSON.stringify({ queryVector, anchorVectors }));
  } catch (e) {
    console.error('[embed] error:', e);
    res.writeHead(500, { 'content-type': 'application/json', ...corsHeaders() });
    res.end(JSON.stringify({ error: String(e?.message ?? e) }));
  }
});

async function main() {
  await loadCache();
  await loadModel();
  const n = await prewarm();
  await new Promise((resolve) => server.listen(PORT, HOST, resolve));
  console.log(`[server] ready (${n} anchors warmed) — listening on http://${HOST}:${PORT}`);
}

process.on('SIGINT', async () => {
  console.log('\n[server] shutting down, flushing cache…');
  await flushCache().catch(() => {});
  process.exit(0);
});

main().catch((e) => {
  console.error('[fatal]', e);
  process.exit(1);
});
