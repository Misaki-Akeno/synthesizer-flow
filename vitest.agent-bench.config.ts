import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/agent/evals/live.bench.ts'],
    fileParallelism: false,
  },
  resolve: {
    alias: [
      {
        find: 'server-only',
        replacement: resolve(__dirname, 'vitest.server-only.ts'),
      },
      {
        find: '@',
        replacement: resolve(__dirname, 'src'),
      },
    ],
  },
});
