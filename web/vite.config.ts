import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: Object.fromEntries(
      ['/customers', '/invoices', '/work-orders', '/engineers', '/dispatch', '/slots'].map(
        (p) => [p, 'http://localhost:4310'],
      ),
    ),
  },
  build: {
    outDir: 'dist',
  },
});
