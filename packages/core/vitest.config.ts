import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 95,
        statements: 95,
      },
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',  // test files
        'src/**/index.ts',   // barrel re-exports — trivially correct, no logic to test
        'src/types/types.ts', // pure TypeScript declarations, no executable code
      ],
    },
  },
})
