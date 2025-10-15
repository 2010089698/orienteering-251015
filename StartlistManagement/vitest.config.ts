import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'Domain/src/**/*.{test,spec}.ts',
      'Application/src/**/*.{test,spec}.ts',
      'Infrastructure/src/**/*.{test,spec}.ts',
      'Presentation/src/**/*.{test,spec}.ts',
    ],
  },
});
