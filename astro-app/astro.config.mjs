import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  redirects: {
    // Firebase email action handler — Astro cannot route paths starting with _,
    // so we redirect Firebase's standard /__/auth/action URL to our handler page.
    '/__/auth/action': '/auth/action',
  },
  vite: {
    plugins: [
      tailwindcss(),
      // Dev-only: allow chrome-extension:// origins to hit API routes
      {
        name: 'chrome-ext-cors',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const origin = req.headers.origin;
            if (origin?.startsWith('chrome-extension://')) {
              res.setHeader('Access-Control-Allow-Origin', origin);
              res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key');
              res.setHeader('Vary', 'Origin');
              if (req.method === 'OPTIONS') {
                console.log(`[CORS] Preflight OK for ${origin} → ${req.url}`);
                res.statusCode = 204;
                res.end();
                return;
              }
            }
            next();
          });
        },
      },
      // Fix: Cloudflare Workers with nodejs_compat sets process to a real
      // Node.js-like object, causing Astro's isNode detection to be true.
      // This makes Astro use renderToAsyncIterable (Node path) instead of
      // renderToReadableStream (web path). The Workers Response constructor
      // can't handle async iterables, producing "[object Object]" as body.
      {
        name: 'fix-cf-streaming',
        transform(code, id) {
          if (id.includes('astro/dist/runtime/server/render/util')) {
            return code.replace(
              'const isNode = typeof process !== "undefined" && Object.prototype.toString.call(process) === "[object process]"',
              'const isNode = false'
            );
          }
        },
      },
    ],
  },
});
