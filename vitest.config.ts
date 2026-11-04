import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    // Test files run in parallel by default, but tests/integration/ share one
    // local database: a file that creates products races a file that counts
    // them. Serial is the safe default; `npm run test:unit` turns parallelism back
    // on for everything outside tests/integration/, which is 8 minutes serial in CI.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.{ts,tsx}', 'server/**/*.ts'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        'src/types/**',
        '**/*.d.ts',
        'server/**/*.types.ts',
      ],
    },
  },
  resolve: {
    // Must mirror tsconfig.json paths, or imports typecheck but fail at runtime.
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@server': path.resolve(__dirname, './server'),
    },
  },
});
