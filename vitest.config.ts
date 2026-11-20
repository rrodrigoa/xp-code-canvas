import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node', coverage: { provider: 'v8', reporter: ['text','html'], include: ['src/shared/**/*.ts'], thresholds: { lines: 90, statements: 90, branches: 85 } } },
});
