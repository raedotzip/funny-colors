import { describe, it, expect } from 'vitest'
import { FBM_GLSL, SIMPLEX_GLSL, WORLEY_GLSL } from './noise.js'
import { compileWithPreamble, evalGlsl } from '../eval-glsl.js'

function countChar(s: string, ch: string): number {
  return [...s].filter(c => c === ch).length
}

const hasBrowser = typeof HTMLCanvasElement !== 'undefined'

// ---------------------------------------------------------------------------
// String structure tests — run in Node and browser
// ---------------------------------------------------------------------------

describe('FBM_GLSL', () => {
  it('is a non-empty string', () => {
    expect(typeof FBM_GLSL).toBe('string')
    expect(FBM_GLSL.trim().length).toBeGreaterThan(0)
  })

  it('contains fbm function signature', () => {
    expect(FBM_GLSL).toContain('fbm(')
  })

  it('contains a loop — characteristic of fractional Brownian motion', () => {
    expect(FBM_GLSL).toContain('for (')
  })

  it('accumulates and returns a float result', () => {
    expect(FBM_GLSL).toContain('return v')
  })

  it('has balanced braces (valid block structure)', () => {
    expect(countChar(FBM_GLSL, '{')).toBe(countChar(FBM_GLSL, '}'))
  })

  it('contains semicolons (valid GLSL statements)', () => {
    expect(FBM_GLSL).toContain(';')
  })

  it('does not contain JavaScript-only keywords', () => {
    expect(FBM_GLSL).not.toContain('let ')
    expect(FBM_GLSL).not.toContain('var ')
    expect(FBM_GLSL).not.toContain('=>')
  })
})

describe('SIMPLEX_GLSL', () => {
  it('is a non-empty string', () => {
    expect(typeof SIMPLEX_GLSL).toBe('string')
    expect(SIMPLEX_GLSL.trim().length).toBeGreaterThan(0)
  })

  it('contains simplex function signature', () => {
    expect(SIMPLEX_GLSL).toContain('simplex(')
  })

  it('uses fract() — fundamental to simplex grid computation', () => {
    expect(SIMPLEX_GLSL).toContain('fract(')
  })

  it('uses dot() — for gradient contribution calculation', () => {
    expect(SIMPLEX_GLSL).toContain('dot(')
  })

  it('uses floor() — to find simplex cell', () => {
    expect(SIMPLEX_GLSL).toContain('floor(')
  })

  it('has balanced braces (valid block structure)', () => {
    expect(countChar(SIMPLEX_GLSL, '{')).toBe(countChar(SIMPLEX_GLSL, '}'))
  })

  it('contains semicolons (valid GLSL statements)', () => {
    expect(SIMPLEX_GLSL).toContain(';')
  })

  it('does not contain JavaScript-only keywords', () => {
    expect(SIMPLEX_GLSL).not.toContain('let ')
    expect(SIMPLEX_GLSL).not.toContain('=>')
  })
})

describe('WORLEY_GLSL', () => {
  it('is a non-empty string', () => {
    expect(typeof WORLEY_GLSL).toBe('string')
    expect(WORLEY_GLSL.trim().length).toBeGreaterThan(0)
  })

  it('contains worley function signature', () => {
    expect(WORLEY_GLSL).toContain('worley(')
  })

  it('uses length() — Worley noise is based on distance', () => {
    expect(WORLEY_GLSL).toContain('length(')
  })

  it('uses min() — accumulates minimum cell distance', () => {
    expect(WORLEY_GLSL).toContain('min(')
  })

  it('searches neighboring cells with nested loops', () => {
    const forCount = (WORLEY_GLSL.match(/for\s*\(/g) ?? []).length
    expect(forCount).toBeGreaterThanOrEqual(2)
  })

  it('has balanced braces (valid block structure)', () => {
    expect(countChar(WORLEY_GLSL, '{')).toBe(countChar(WORLEY_GLSL, '}'))
  })

  it('contains semicolons (valid GLSL statements)', () => {
    expect(WORLEY_GLSL).toContain(';')
  })

  it('does not contain JavaScript-only keywords', () => {
    expect(WORLEY_GLSL).not.toContain('let ')
    expect(WORLEY_GLSL).not.toContain('=>')
  })
})

// ---------------------------------------------------------------------------
// GLSL compilation + execution tests — browser only
// ---------------------------------------------------------------------------

describe.skipIf(!hasBrowser)('FBM_GLSL — GLSL compilation and execution', () => {
  it('compiles as a fragment shader preamble', () => {
    expect(() => compileWithPreamble(FBM_GLSL)).not.toThrow()
  })

  it('fbm(vec2(0)) output is in [0, 1] (value noise accumulator)', () => {
    const [r] = evalGlsl(FBM_GLSL, 'fragColor = vec4(fbm(vec2(0.0)), 0.0, 0.0, 1.0);')
    expect(r).toBeGreaterThanOrEqual(0.0)
    expect(r).toBeLessThanOrEqual(1.0)
  })

  it('fbm produces different values at two inputs — encoded as abs diff > 0', () => {
    const [r] = evalGlsl(
      FBM_GLSL,
      'float d = abs(fbm(vec2(0.0)) - fbm(vec2(3.14159, 2.71828))); fragColor = vec4(min(d * 4.0, 1.0), 0.0, 0.0, 1.0);',
    )
    expect(r).toBeGreaterThan(0.01)
  })
})

describe.skipIf(!hasBrowser)('SIMPLEX_GLSL — GLSL compilation and execution', () => {
  it('compiles as a fragment shader preamble', () => {
    expect(() => compileWithPreamble(SIMPLEX_GLSL)).not.toThrow()
  })

  it('simplex(vec2(0)) is in [-1, 1] — mapped to [0,1] stays in bounds', () => {
    const [r] = evalGlsl(SIMPLEX_GLSL, 'fragColor = vec4(simplex(vec2(0.0)) * 0.5 + 0.5, 0.0, 0.0, 1.0);')
    expect(r).toBeGreaterThanOrEqual(0.0)
    expect(r).toBeLessThanOrEqual(1.0)
  })

  it('simplex produces different values at two inputs — encoded as abs diff > 0', () => {
    const [r] = evalGlsl(
      SIMPLEX_GLSL,
      'float d = abs(simplex(vec2(0.0)) - simplex(vec2(1.3, 0.7))); fragColor = vec4(min(d * 2.0, 1.0), 0.0, 0.0, 1.0);',
    )
    expect(r).toBeGreaterThan(0.01)
  })
})

describe.skipIf(!hasBrowser)('WORLEY_GLSL — GLSL compilation and execution', () => {
  it('compiles as a fragment shader preamble', () => {
    expect(() => compileWithPreamble(WORLEY_GLSL)).not.toThrow()
  })

  it('worley(vec2(0)) output is in [0, 1] (minimum cell distance)', () => {
    const [r] = evalGlsl(WORLEY_GLSL, 'fragColor = vec4(worley(vec2(0.0)), 0.0, 0.0, 1.0);')
    expect(r).toBeGreaterThanOrEqual(0.0)
    expect(r).toBeLessThanOrEqual(1.0)
  })

  it('worley produces different values at two inputs — encoded as abs diff > 0', () => {
    const [r] = evalGlsl(
      WORLEY_GLSL,
      'float d = abs(worley(vec2(0.0)) - worley(vec2(2.5, 1.1))); fragColor = vec4(min(d * 4.0, 1.0), 0.0, 0.0, 1.0);',
    )
    expect(r).toBeGreaterThan(0.01)
  })
})
