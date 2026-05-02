import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      name: 'chromium',
      provider: 'playwright',
    },
    include: ['src/webgl/**/*.test.ts', 'src/math/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/webgl/**/*.ts', 'src/math/**/*.ts'],
      exclude: [
        'src/webgl/**/*.test.ts',
        'src/webgl/index.ts',
        'src/math/**/*.test.ts',
        'src/math/**/index.ts',
        'src/math/eval-glsl.ts',
      ],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
})
