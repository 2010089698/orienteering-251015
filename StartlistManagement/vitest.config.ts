import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/**/*.{test,spec}.{ts,tsx}'],
  },
  projects: [path.resolve(__dirname, '../apps/frontend/vitest.config.ts')],
});
