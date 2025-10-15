import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/**/*.{test,spec}.{ts,tsx}'],
  },
  projects: ['./apps/frontend/vitest.config.ts'],
});
