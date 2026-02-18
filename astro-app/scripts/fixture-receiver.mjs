#!/usr/bin/env node
/**
 * Tiny HTTP server that accepts POST requests with HTML content
 * and saves them as fixture files. Used by browser automation to
 * capture rendered HTML from sites with strict CSP.
 *
 * Usage: node scripts/fixture-receiver.mjs
 * Then POST from browser: fetch('http://localhost:9876/save/uk_zoopla', {method:'POST', body: html})
 */
import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '..', 'test', 'fixtures');
const PORT = 9876;

const server = createServer((req, res) => {
  // CORS headers for cross-origin requests from any property site
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url.startsWith('/save/')) {
    const name = req.url.slice(6); // strip /save/
    if (!name || name.includes('..') || name.includes('/')) {
      res.writeHead(400);
      res.end('Invalid name');
      return;
    }

    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      let html = Buffer.concat(chunks).toString('utf-8');
      // Handle form-encoded data (from enctype="text/plain" forms)
      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('text/plain') && html.startsWith('html=')) {
        html = html.replace(/^html=/, '').replace(/\r?\n$/, '');
      }
      // Handle URL-encoded form data
      if (contentType.includes('x-www-form-urlencoded') && html.startsWith('html=')) {
        html = decodeURIComponent(html.replace(/^html=/, '').replace(/\+/g, ' '));
      }
      const outPath = resolve(FIXTURES_DIR, `${name}.html`);
      writeFileSync(outPath, html, 'utf-8');
      const msg = `Saved ${name}.html (${html.length} bytes)`;
      console.log(msg);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(msg);
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found. POST to /save/<fixture-name>');
});

server.listen(PORT, () => {
  console.log(`Fixture receiver listening on http://localhost:${PORT}`);
  console.log(`POST HTML to http://localhost:${PORT}/save/<name>`);
  console.log(`Files will be saved to: ${FIXTURES_DIR}`);
});
