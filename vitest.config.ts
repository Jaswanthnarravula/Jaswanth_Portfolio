import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: {
    globals: false,
    pool: 'threads',
    maxWorkers: 4,
    restoreMocks: true,
    projects: [
      { extends: true, test: { name: 'unit', environment: 'node', include: ['tests/**/*.test.ts'] } },
      {
        extends: true,
        test: {
          name: 'component',
          environment: 'jsdom',
          include: ['tests/**/*.test.tsx'],
          setupFiles: ['tests/setup.ts'],
          env: { NEXT_PUBLIC_OS_PREVIEW: 'all' },
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts', 'stores/**/*.ts', 'data/**/*.ts', 'components/**/*.{ts,tsx}'],
      exclude: [
        '**/*.d.ts',
        'data/generated/**',
        '**/types.ts',
        '**/schema.ts',
        // Needs a real WebGL2 context, which jsdom cannot provide; the forced-tier e2e tests exercise it
        // (HELLO-GL-01, PERF-GL-01, PERF-GL-02 in tests/e2e/performance.spec.ts).
        'lib/webgl/glass-stage.ts',
      ],
      reporter: ['text', 'json-summary', 'html', 'lcov'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
        'lib/kernel/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
        'lib/terminal/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
      },
    },
  },
});
