import { describe, it, expect } from 'vitest'
import { REMAP_GLSL, SMOOTHSTEP_GLSL, ROTATE2D_GLSL } from './math.js'
import { compileWithPreamble, evalGlsl } from '../eval-glsl.js'

function countChar(s: string, ch: string): number {
  return [...s].filter(c => c === ch).length
}

const hasBrowser = typeof HTMLCanvasElement !== 'undefined'

// Tolerance reflects RGBA8 readback precision: 1/255 ≈ 0.004 → use 1 decimal place (±0.005).
const PREC = 1

// ---------------------------------------------------------------------------
// String structure tests — run in Node and browser
// ---------------------------------------------------------------------------

describe('REMAP_GLSL', () => {
  it('is a non-empty string', () => {
    expect(typeof REMAP_GLSL).toBe('string')
    expect(REMAP_GLSL.trim().length).toBeGreaterThan(0)
  })

  it('contains remap function signature', () => {
    expect(REMAP_GLSL).toContain('remap(')
  })

  it('returns a float', () => {
    expect(REMAP_GLSL).toContain('float remap(')
  })

  it('accepts inMin and inMax parameters', () => {
    expect(REMAP_GLSL).toContain('inMin')
    expect(REMAP_GLSL).toContain('inMax')
  })

  it('accepts outMin and outMax parameters', () => {
    expect(REMAP_GLSL).toContain('outMin')
    expect(REMAP_GLSL).toContain('outMax')
  })

  it('contains division — core of remapping (v - inMin) / (inMax - inMin)', () => {
    expect(REMAP_GLSL).toContain('/')
  })

  it('has balanced braces (valid block structure)', () => {
    expect(countChar(REMAP_GLSL, '{')).toBe(countChar(REMAP_GLSL, '}'))
  })

  it('does not contain JavaScript-only keywords', () => {
    expect(REMAP_GLSL).not.toContain('let ')
    expect(REMAP_GLSL).not.toContain('=>')
  })
})

describe('SMOOTHSTEP_GLSL', () => {
  it('is a non-empty string', () => {
    expect(typeof SMOOTHSTEP_GLSL).toBe('string')
    expect(SMOOTHSTEP_GLSL.trim().length).toBeGreaterThan(0)
  })

  it('contains smoothstepCustom function signature', () => {
    expect(SMOOTHSTEP_GLSL).toContain('smoothstepCustom(')
  })

  it('returns a float', () => {
    expect(SMOOTHSTEP_GLSL).toContain('float smoothstepCustom(')
  })

  it('uses clamp() — prevents extrapolation outside [0, 1]', () => {
    expect(SMOOTHSTEP_GLSL).toContain('clamp(')
  })

  it('contains the cubic coefficient 3.0 — Hermite interpolation', () => {
    expect(SMOOTHSTEP_GLSL).toContain('3.0')
  })

  it('contains the cubic coefficient 2.0 — t*t*(3-2t) formula', () => {
    expect(SMOOTHSTEP_GLSL).toContain('2.0')
  })

  it('has balanced braces (valid block structure)', () => {
    expect(countChar(SMOOTHSTEP_GLSL, '{')).toBe(countChar(SMOOTHSTEP_GLSL, '}'))
  })

  it('does not contain JavaScript-only keywords', () => {
    expect(SMOOTHSTEP_GLSL).not.toContain('let ')
    expect(SMOOTHSTEP_GLSL).not.toContain('=>')
  })
})

describe('ROTATE2D_GLSL', () => {
  it('is a non-empty string', () => {
    expect(typeof ROTATE2D_GLSL).toBe('string')
    expect(ROTATE2D_GLSL.trim().length).toBeGreaterThan(0)
  })

  it('contains rotate2d function signature', () => {
    expect(ROTATE2D_GLSL).toContain('rotate2d(')
  })

  it('returns a mat2', () => {
    expect(ROTATE2D_GLSL).toContain('mat2 rotate2d(')
  })

  it('uses sin() — for rotation matrix components', () => {
    expect(ROTATE2D_GLSL).toContain('sin(')
  })

  it('uses cos() — for rotation matrix components', () => {
    expect(ROTATE2D_GLSL).toContain('cos(')
  })

  it('constructs a mat2 result', () => {
    expect(ROTATE2D_GLSL).toContain('mat2(')
  })

  it('has balanced braces (valid block structure)', () => {
    expect(countChar(ROTATE2D_GLSL, '{')).toBe(countChar(ROTATE2D_GLSL, '}'))
  })

  it('does not contain JavaScript-only keywords', () => {
    expect(ROTATE2D_GLSL).not.toContain('let ')
    expect(ROTATE2D_GLSL).not.toContain('=>')
  })
})

// ---------------------------------------------------------------------------
// GLSL compilation + execution tests — browser only
// ---------------------------------------------------------------------------

describe.skipIf(!hasBrowser)('REMAP_GLSL — GLSL compilation and execution', () => {
  it('compiles as a fragment shader preamble', () => {
    expect(() => compileWithPreamble(REMAP_GLSL)).not.toThrow()
  })

  it('identity remap: remap(0.5, 0.0, 1.0, 0.0, 1.0) = 0.5', () => {
    const [r] = evalGlsl(REMAP_GLSL, 'fragColor = vec4(remap(0.5, 0.0, 1.0, 0.0, 1.0), 0.0, 0.0, 1.0);')
    expect(r).toBeCloseTo(0.5, PREC)
  })

  it('scale remap: remap(0.5, 0.0, 1.0, 0.0, 2.0) = 1.0 (clamped by RGBA8)', () => {
    const [r] = evalGlsl(REMAP_GLSL, 'fragColor = vec4(remap(0.5, 0.0, 1.0, 0.0, 2.0), 0.0, 0.0, 1.0);')
    expect(r).toBeCloseTo(1.0, PREC)
  })

  it('shift remap: remap(0.0, -1.0, 1.0, 0.0, 1.0) = 0.5', () => {
    const [r] = evalGlsl(REMAP_GLSL, 'fragColor = vec4(remap(0.0, -1.0, 1.0, 0.0, 1.0), 0.0, 0.0, 1.0);')
    expect(r).toBeCloseTo(0.5, PREC)
  })

  it('at inMin: remap(0.2, 0.2, 0.8, 0.0, 1.0) = 0.0', () => {
    const [r] = evalGlsl(REMAP_GLSL, 'fragColor = vec4(remap(0.2, 0.2, 0.8, 0.0, 1.0), 0.0, 0.0, 1.0);')
    expect(r).toBeCloseTo(0.0, PREC)
  })

  it('at inMax: remap(0.8, 0.2, 0.8, 0.0, 1.0) = 1.0', () => {
    const [r] = evalGlsl(REMAP_GLSL, 'fragColor = vec4(remap(0.8, 0.2, 0.8, 0.0, 1.0), 0.0, 0.0, 1.0);')
    expect(r).toBeCloseTo(1.0, PREC)
  })

  it('divide-by-zero (inMin == inMax) does not crash the shader', () => {
    expect(() =>
      evalGlsl(REMAP_GLSL, 'fragColor = vec4(remap(0.5, 0.0, 0.0, 0.0, 1.0), 0.0, 0.0, 1.0);'),
    ).not.toThrow()
  })
})

describe.skipIf(!hasBrowser)('SMOOTHSTEP_GLSL — GLSL compilation and execution', () => {
  it('compiles as a fragment shader preamble', () => {
    expect(() => compileWithPreamble(SMOOTHSTEP_GLSL)).not.toThrow()
  })

  it('at edge0 (t=0): result = 0.0', () => {
    const [r] = evalGlsl(SMOOTHSTEP_GLSL, 'fragColor = vec4(smoothstepCustom(0.0, 1.0, 0.0), 0.0, 0.0, 1.0);')
    expect(r).toBeCloseTo(0.0, PREC)
  })

  it('at edge1 (t=1): result = 1.0', () => {
    const [r] = evalGlsl(SMOOTHSTEP_GLSL, 'fragColor = vec4(smoothstepCustom(0.0, 1.0, 1.0), 0.0, 0.0, 1.0);')
    expect(r).toBeCloseTo(1.0, PREC)
  })

  it('at midpoint (t=0.5): result = 0.5 (Hermite midpoint symmetry)', () => {
    const [r] = evalGlsl(SMOOTHSTEP_GLSL, 'fragColor = vec4(smoothstepCustom(0.0, 1.0, 0.5), 0.0, 0.0, 1.0);')
    expect(r).toBeCloseTo(0.5, PREC)
  })

  it('below edge0 clamps to 0.0', () => {
    const [r] = evalGlsl(SMOOTHSTEP_GLSL, 'fragColor = vec4(smoothstepCustom(0.0, 1.0, -1.0), 0.0, 0.0, 1.0);')
    expect(r).toBeCloseTo(0.0, PREC)
  })

  it('above edge1 clamps to 1.0', () => {
    const [r] = evalGlsl(SMOOTHSTEP_GLSL, 'fragColor = vec4(smoothstepCustom(0.0, 1.0, 2.0), 0.0, 0.0, 1.0);')
    expect(r).toBeCloseTo(1.0, PREC)
  })

  it('output is monotonically increasing — t=0.25 < t=0.75', () => {
    const [r0] = evalGlsl(SMOOTHSTEP_GLSL, 'fragColor = vec4(smoothstepCustom(0.0, 1.0, 0.25), 0.0, 0.0, 1.0);')
    const [r1] = evalGlsl(SMOOTHSTEP_GLSL, 'fragColor = vec4(smoothstepCustom(0.0, 1.0, 0.75), 0.0, 0.0, 1.0);')
    expect(r0).toBeLessThan(r1)
  })
})

describe.skipIf(!hasBrowser)('ROTATE2D_GLSL — GLSL compilation and execution', () => {
  it('compiles as a fragment shader preamble', () => {
    expect(() => compileWithPreamble(ROTATE2D_GLSL)).not.toThrow()
  })

  it('identity (angle=0): rotate2d(0) * vec2(1,0) → x=1', () => {
    const [r] = evalGlsl(
      ROTATE2D_GLSL,
      'vec2 v = rotate2d(0.0) * vec2(1.0, 0.0); fragColor = vec4(v.x, 0.0, 0.0, 1.0);',
    )
    expect(r).toBeCloseTo(1.0, PREC)
  })

  it('identity (angle=0): rotate2d(0) * vec2(0,1) → y=1', () => {
    const [r] = evalGlsl(
      ROTATE2D_GLSL,
      'vec2 v = rotate2d(0.0) * vec2(0.0, 1.0); fragColor = vec4(v.y, 0.0, 0.0, 1.0);',
    )
    expect(r).toBeCloseTo(1.0, PREC)
  })

  it('180 degrees: rotate2d(PI) flips x — encode as |x| ≈ 1', () => {
    const [r] = evalGlsl(
      ROTATE2D_GLSL,
      'vec2 v = rotate2d(3.14159265) * vec2(1.0, 0.0); fragColor = vec4(abs(v.x), 0.0, 0.0, 1.0);',
    )
    expect(r).toBeCloseTo(1.0, PREC)
  })

  it('rotation preserves vector length — |rotate2d(PI/4) * vec2(1,0)| = 1', () => {
    const [r] = evalGlsl(
      ROTATE2D_GLSL,
      'vec2 v = rotate2d(0.7854) * vec2(1.0, 0.0); fragColor = vec4(length(v), 0.0, 0.0, 1.0);',
    )
    expect(r).toBeCloseTo(1.0, PREC)
  })
})
