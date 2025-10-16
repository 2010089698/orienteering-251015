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
      '/api': {
        target: 'http://localhost:3000',
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
