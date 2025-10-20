import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/application/src/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@event-management/domain': path.resolve(__dirname, 'packages/domain/src/index.ts'),
      '@event-management/application': path.resolve(__dirname, 'packages/application/src/index.ts'),
    },
  },
});
