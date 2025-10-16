import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    name: 'frontend',
    environment: 'jsdom',
    setupFiles: path.resolve(__dirname, 'src/test/setup.ts'),
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    globals: true,
    css: false,
  },
});
