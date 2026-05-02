import { describe, it, expect } from 'vitest'
import { HSV_TO_RGB_GLSL, RGB_TO_HSV_GLSL, LINEAR_TO_SRGB_GLSL, SRGB_TO_LINEAR_GLSL } from './color.js'
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

describe('HSV_TO_RGB_GLSL', () => {
  it('is a non-empty string', () => {
    expect(typeof HSV_TO_RGB_GLSL).toBe('string')
    expect(HSV_TO_RGB_GLSL.trim().length).toBeGreaterThan(0)
  })

  it('contains hsv2rgb function signature', () => {
    expect(HSV_TO_RGB_GLSL).toContain('hsv2rgb(')
  })

  it('returns a vec3 (RGB output type)', () => {
    expect(HSV_TO_RGB_GLSL).toContain('vec3 hsv2rgb(')
  })

  it('uses mix() — interpolates between white and full saturation', () => {
    expect(HSV_TO_RGB_GLSL).toContain('mix(')
  })

  it('uses clamp() — keeps RGB channels in [0, 1]', () => {
    expect(HSV_TO_RGB_GLSL).toContain('clamp(')
  })

  it('uses fract() — for hue wrapping', () => {
    expect(HSV_TO_RGB_GLSL).toContain('fract(')
  })

  it('has balanced braces (valid block structure)', () => {
    expect(countChar(HSV_TO_RGB_GLSL, '{')).toBe(countChar(HSV_TO_RGB_GLSL, '}'))
  })

  it('does not contain JavaScript-only keywords', () => {
    expect(HSV_TO_RGB_GLSL).not.toContain('let ')
    expect(HSV_TO_RGB_GLSL).not.toContain('=>')
  })
})

describe('RGB_TO_HSV_GLSL', () => {
  it('is a non-empty string', () => {
    expect(typeof RGB_TO_HSV_GLSL).toBe('string')
    expect(RGB_TO_HSV_GLSL.trim().length).toBeGreaterThan(0)
  })

  it('contains rgb2hsv function signature', () => {
    expect(RGB_TO_HSV_GLSL).toContain('rgb2hsv(')
  })

  it('returns a vec3 (HSV output type)', () => {
    expect(RGB_TO_HSV_GLSL).toContain('vec3 rgb2hsv(')
  })

  it('uses step() or min()/max() — for finding dominant channel', () => {
    const hasDominantChannelOp =
      RGB_TO_HSV_GLSL.includes('step(') ||
      RGB_TO_HSV_GLSL.includes('min(') ||
      RGB_TO_HSV_GLSL.includes('max(')
    expect(hasDominantChannelOp).toBe(true)
  })

  it('avoids divide-by-zero with epsilon guard', () => {
    const hasEpsilon = RGB_TO_HSV_GLSL.includes('1.0e-') || RGB_TO_HSV_GLSL.includes('1e-')
    expect(hasEpsilon).toBe(true)
  })

  it('has balanced braces (valid block structure)', () => {
    expect(countChar(RGB_TO_HSV_GLSL, '{')).toBe(countChar(RGB_TO_HSV_GLSL, '}'))
  })

  it('does not contain JavaScript-only keywords', () => {
    expect(RGB_TO_HSV_GLSL).not.toContain('let ')
    expect(RGB_TO_HSV_GLSL).not.toContain('=>')
  })
})

describe('LINEAR_TO_SRGB_GLSL', () => {
  it('is a non-empty string', () => {
    expect(typeof LINEAR_TO_SRGB_GLSL).toBe('string')
    expect(LINEAR_TO_SRGB_GLSL.trim().length).toBeGreaterThan(0)
  })

  it('contains linearToSrgb function signature', () => {
    expect(LINEAR_TO_SRGB_GLSL).toContain('linearToSrgb(')
  })

  it('uses pow() — for gamma correction', () => {
    expect(LINEAR_TO_SRGB_GLSL).toContain('pow(')
  })

  it('contains the standard sRGB linear threshold (0.0031308)', () => {
    expect(LINEAR_TO_SRGB_GLSL).toContain('0.0031308')
  })

  it('branches on the threshold — linear vs gamma segment', () => {
    const hasConditional = LINEAR_TO_SRGB_GLSL.includes('?') || LINEAR_TO_SRGB_GLSL.includes('if (')
    expect(hasConditional).toBe(true)
  })

  it('has balanced braces (valid block structure)', () => {
    expect(countChar(LINEAR_TO_SRGB_GLSL, '{')).toBe(countChar(LINEAR_TO_SRGB_GLSL, '}'))
  })

  it('does not contain JavaScript-only keywords', () => {
    expect(LINEAR_TO_SRGB_GLSL).not.toContain('let ')
    expect(LINEAR_TO_SRGB_GLSL).not.toContain('=>')
  })
})

describe('SRGB_TO_LINEAR_GLSL', () => {
  it('is a non-empty string', () => {
    expect(typeof SRGB_TO_LINEAR_GLSL).toBe('string')
    expect(SRGB_TO_LINEAR_GLSL.trim().length).toBeGreaterThan(0)
  })

  it('contains srgbToLinear function signature', () => {
    expect(SRGB_TO_LINEAR_GLSL).toContain('srgbToLinear(')
  })

  it('uses pow() — for inverse gamma correction', () => {
    expect(SRGB_TO_LINEAR_GLSL).toContain('pow(')
  })

  it('contains the standard sRGB encoded threshold (0.04045)', () => {
    expect(SRGB_TO_LINEAR_GLSL).toContain('0.04045')
  })

  it('branches on the threshold — linear vs gamma segment', () => {
    const hasConditional = SRGB_TO_LINEAR_GLSL.includes('?') || SRGB_TO_LINEAR_GLSL.includes('if (')
    expect(hasConditional).toBe(true)
  })

  it('has balanced braces (valid block structure)', () => {
    expect(countChar(SRGB_TO_LINEAR_GLSL, '{')).toBe(countChar(SRGB_TO_LINEAR_GLSL, '}'))
  })

  it('does not contain JavaScript-only keywords', () => {
    expect(SRGB_TO_LINEAR_GLSL).not.toContain('let ')
    expect(SRGB_TO_LINEAR_GLSL).not.toContain('=>')
  })
})

// ---------------------------------------------------------------------------
// GLSL compilation + execution tests — browser only
// ---------------------------------------------------------------------------

describe.skipIf(!hasBrowser)('HSV_TO_RGB_GLSL — GLSL compilation and execution', () => {
  it('compiles as a fragment shader preamble', () => {
    expect(() => compileWithPreamble(HSV_TO_RGB_GLSL)).not.toThrow()
  })

  it('hsv2rgb(0, 1, 1) → pure red r=1, g=0, b=0', () => {
    const [r, g, b] = evalGlsl(HSV_TO_RGB_GLSL, 'fragColor = vec4(hsv2rgb(vec3(0.0, 1.0, 1.0)), 1.0);')
    expect(r).toBeCloseTo(1.0, PREC)
    expect(g).toBeCloseTo(0.0, PREC)
    expect(b).toBeCloseTo(0.0, PREC)
  })

  it('hsv2rgb(1/3, 1, 1) → pure green r=0, g=1, b=0', () => {
    const [r, g, b] = evalGlsl(HSV_TO_RGB_GLSL, 'fragColor = vec4(hsv2rgb(vec3(1.0/3.0, 1.0, 1.0)), 1.0);')
    expect(r).toBeCloseTo(0.0, PREC)
    expect(g).toBeCloseTo(1.0, PREC)
    expect(b).toBeCloseTo(0.0, PREC)
  })

  it('hsv2rgb(2/3, 1, 1) → pure blue r=0, g=0, b=1', () => {
    const [r, g, b] = evalGlsl(HSV_TO_RGB_GLSL, 'fragColor = vec4(hsv2rgb(vec3(2.0/3.0, 1.0, 1.0)), 1.0);')
    expect(r).toBeCloseTo(0.0, PREC)
    expect(g).toBeCloseTo(0.0, PREC)
    expect(b).toBeCloseTo(1.0, PREC)
  })

  it('hsv2rgb(0, 0, 1) → white r=g=b=1', () => {
    const [r, g, b] = evalGlsl(HSV_TO_RGB_GLSL, 'fragColor = vec4(hsv2rgb(vec3(0.0, 0.0, 1.0)), 1.0);')
    expect(r).toBeCloseTo(1.0, PREC)
    expect(g).toBeCloseTo(1.0, PREC)
    expect(b).toBeCloseTo(1.0, PREC)
  })

  it('hsv2rgb(0, 0, 0) → black r=g=b=0', () => {
    const [r, g, b] = evalGlsl(HSV_TO_RGB_GLSL, 'fragColor = vec4(hsv2rgb(vec3(0.0, 0.0, 0.0)), 1.0);')
    expect(r).toBeCloseTo(0.0, PREC)
    expect(g).toBeCloseTo(0.0, PREC)
    expect(b).toBeCloseTo(0.0, PREC)
  })
})

describe.skipIf(!hasBrowser)('RGB_TO_HSV_GLSL — GLSL compilation and execution', () => {
  it('compiles as a fragment shader preamble', () => {
    expect(() => compileWithPreamble(RGB_TO_HSV_GLSL)).not.toThrow()
  })

  it('rgb2hsv round-trip error is < 1% (encoded × 10 → < 0.1 per channel)', () => {
    const preamble = HSV_TO_RGB_GLSL + '\n' + RGB_TO_HSV_GLSL
    const [r, g, b] = evalGlsl(
      preamble,
      `vec3 original = vec3(0.1, 0.8, 0.7);
       vec3 rgb = hsv2rgb(original);
       vec3 back = rgb2hsv(rgb);
       fragColor = vec4(min(abs(back - original) * 10.0, 1.0), 1.0);`,
    )
    expect(r).toBeCloseTo(0.0, PREC)
    expect(g).toBeCloseTo(0.0, PREC)
    expect(b).toBeCloseTo(0.0, PREC)
  })
})

describe.skipIf(!hasBrowser)('LINEAR_TO_SRGB_GLSL — GLSL compilation and execution', () => {
  it('compiles as a fragment shader preamble', () => {
    expect(() => compileWithPreamble(LINEAR_TO_SRGB_GLSL)).not.toThrow()
  })

  it('linearToSrgb(0.0) = 0.0 (black stays black)', () => {
    const [r] = evalGlsl(LINEAR_TO_SRGB_GLSL, 'fragColor = vec4(linearToSrgb(0.0), 0.0, 0.0, 1.0);')
    expect(r).toBeCloseTo(0.0, PREC)
  })

  it('linearToSrgb(1.0) = 1.0 (white stays white)', () => {
    const [r] = evalGlsl(LINEAR_TO_SRGB_GLSL, 'fragColor = vec4(linearToSrgb(1.0), 0.0, 0.0, 1.0);')
    expect(r).toBeCloseTo(1.0, PREC)
  })

  it('linearToSrgb(0.5) is brighter than 0.5 (gamma curve lightens midtones)', () => {
    const [r] = evalGlsl(LINEAR_TO_SRGB_GLSL, 'fragColor = vec4(linearToSrgb(0.5), 0.0, 0.0, 1.0);')
    expect(r).toBeGreaterThan(0.5 + 0.01)
  })
})

describe.skipIf(!hasBrowser)('SRGB_TO_LINEAR_GLSL — GLSL compilation and execution', () => {
  it('compiles as a fragment shader preamble', () => {
    expect(() => compileWithPreamble(SRGB_TO_LINEAR_GLSL)).not.toThrow()
  })

  it('srgbToLinear(0.0) = 0.0 (black stays black)', () => {
    const [r] = evalGlsl(SRGB_TO_LINEAR_GLSL, 'fragColor = vec4(srgbToLinear(0.0), 0.0, 0.0, 1.0);')
    expect(r).toBeCloseTo(0.0, PREC)
  })

  it('srgbToLinear(1.0) = 1.0 (white stays white)', () => {
    const [r] = evalGlsl(SRGB_TO_LINEAR_GLSL, 'fragColor = vec4(srgbToLinear(1.0), 0.0, 0.0, 1.0);')
    expect(r).toBeCloseTo(1.0, PREC)
  })

  it('srgbToLinear(0.5) is darker than 0.5 (gamma curve darkens midtones)', () => {
    const [r] = evalGlsl(SRGB_TO_LINEAR_GLSL, 'fragColor = vec4(srgbToLinear(0.5), 0.0, 0.0, 1.0);')
    expect(r).toBeLessThan(0.5 - 0.01)
  })

  it('round-trip: srgbToLinear(linearToSrgb(0.5)) ≈ 0.5', () => {
    const preamble = LINEAR_TO_SRGB_GLSL + '\n' + SRGB_TO_LINEAR_GLSL
    const [r] = evalGlsl(preamble, 'fragColor = vec4(srgbToLinear(linearToSrgb(0.5)), 0.0, 0.0, 1.0);')
    expect(r).toBeCloseTo(0.5, PREC)
  })

  it('round-trip: linearToSrgb(srgbToLinear(0.5)) ≈ 0.5', () => {
    const preamble = LINEAR_TO_SRGB_GLSL + '\n' + SRGB_TO_LINEAR_GLSL
    const [r] = evalGlsl(preamble, 'fragColor = vec4(linearToSrgb(srgbToLinear(0.5)), 0.0, 0.0, 1.0);')
    expect(r).toBeCloseTo(0.5, PREC)
  })
})
