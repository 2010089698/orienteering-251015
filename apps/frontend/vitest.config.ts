import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const projectRoot = path.resolve(__dirname);
const srcRoot = path.resolve(projectRoot, 'src');

export default defineConfig({
  root: projectRoot,
  plugins: [react()],
  resolve: {
    alias: {
      '@': srcRoot,
    },
  },
  test: {
    name: 'frontend',
    environment: 'jsdom',
    setupFiles: path.resolve(srcRoot, 'test/setup.ts'),
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    globals: true,
    css: false,
  },
});
