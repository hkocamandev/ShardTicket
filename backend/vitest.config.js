import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['test/**/*.test.js'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      enabled: false,
      provider: 'v8',
      reportsDirectory: './test/coverage',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.js'],
      exclude: [
        'src/app.js',
        'src/server.js',
        'src/config/**',
        'src/models/**',
        'src/routes/**',
        'src/controllers/**',
      ],
      thresholds: {
        lines: 80,
        functions: 75,
        statements: 80,
        branches: 75,
      },
    },
  },
});
