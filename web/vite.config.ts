import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { IncomingMessage } from 'node:http';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: Object.fromEntries(
      ['/customers', '/invoices', '/work-orders', '/engineers', '/dispatch', '/slots'].map(
        (p) => [
          p,
          {
            target: 'http://localhost:4310',
            // Document navigations (page refresh / deep link on /customers etc.)
            // must stay in the dev app; only fetch/XHR calls hit the API proxy.
            bypass: (req: IncomingMessage) =>
              req.headers.accept?.includes('text/html') ? '/index.html' : undefined,
          },
        ],
      ),
    ),
  },
  build: {
    outDir: 'dist',
  },
});
