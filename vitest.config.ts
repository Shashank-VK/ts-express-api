import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      reporter: ['text', 'html'],
      exclude: ['src/server.ts', 'src/lib/prisma.ts', 'src/repositories/prisma-repositories.ts'],
    },
  },
});
