import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/**/*.{test,spec}.ts'],
  },
  resolve: {
    alias: {
      '@event-management/domain': path.resolve(__dirname, 'packages/domain/src/index.ts'),
      '@event-management/application': path.resolve(
        __dirname,
        'packages/application/src/index.ts',
      ),
      '@event-management/infrastructure': path.resolve(
        __dirname,
        'packages/infrastructure/src/index.ts',
      ),
      '@event-management/adapters-http': path.resolve(
        __dirname,
        'packages/adapters-http/src/index.ts',
      ),
    },
  },
});
