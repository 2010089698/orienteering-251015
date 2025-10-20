import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const projectRoot = path.resolve(__dirname);
const srcRoot = path.resolve(projectRoot, 'src');

export default defineConfig({
  root: projectRoot,
  plugins: [react()],
  server: {
    proxy: {
      '/api/startlists': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/api/japan-ranking': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/api/entries': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/events': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': srcRoot,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
