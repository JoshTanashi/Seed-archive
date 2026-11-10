import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the same build runs from Capacitor's local scheme, a
// sub-path on the web, or the file system.
export default defineConfig({
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
  build: { target: 'es2020', assetsInlineLimit: 0 },
  test: { include: ['tests/**/*.test.ts'], testTimeout: 120000 },
} as never);
