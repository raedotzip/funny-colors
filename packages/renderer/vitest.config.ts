import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/math/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/math/**/*.ts'],
      exclude: ['src/math/**/*.test.ts', 'src/math/**/index.ts', 'src/math/eval-glsl.ts'],
      thresholds: { lines: 95, functions: 95, branches: 90, statements: 95 },
    },
  },
})
