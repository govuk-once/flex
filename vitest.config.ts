import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    include: ['domains/*/**/*.test.ts', 'libs/*/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
    },
    isolate: true,
  },
});
