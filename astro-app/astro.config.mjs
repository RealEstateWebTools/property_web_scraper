import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  vite: {
    plugins: [
      tailwindcss(),
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
