import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts',
    exclude: [...configDefaults.exclude, 'e2e/**'],
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
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.d.ts'],
  },
});
