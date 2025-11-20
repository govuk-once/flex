import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    tsconfigPaths({
      // Enabling for now as it is moaning about the generator
      ignoreConfigErrors: true,
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    exclude: ['tools/*', 'node_modules'],
    include: ['**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
    },
    isolate: true,
  },
});
