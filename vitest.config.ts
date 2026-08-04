import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      // Coverage targets are per-layer, not a global threshold — see docs/TESTING.md.
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
    // Must mirror the paths in tsconfig.json, or imports resolve at typecheck
    // time and fail at test time. `@server` covers ~167 imports since the
    // domain restructure (docs/adr/0012-...), so omitting it breaks every
    // test that touches server code.
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@server': path.resolve(__dirname, './server'),
    },
  },
});
