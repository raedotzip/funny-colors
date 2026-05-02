/**
 * @fileoverview General-purpose math GLSL helpers for `@funny-colors/renderer`.
 *
 * Each export is a self-contained GLSL 300 es string ready to be prepended to
 * a fragment shader. Functions have no external dependencies and can be
 * concatenated in any order.
 *
 * @see {@link REMAP_GLSL}
 * @see {@link SMOOTHSTEP_GLSL}
 * @see {@link ROTATE2D_GLSL}
 *
 * @module
 */

/**
 * GLSL string defining
 * `float remap(float v, float inMin, float inMax, float outMin, float outMax)`.
 *
 * Linearly maps `v` from the input range [`inMin`, `inMax`] to the output
 * range [`outMin`, `outMax`]. The function does not clamp — values outside
 * the input range are extrapolated.
 *
 * @remarks
 * When `inMin === inMax` the divisor is zero. GLSL returns `Inf` or `NaN` in
 * this case; guard against degenerate ranges at the call site if needed.
 *
 * @example
 * ```ts
 * const fragSrc = REMAP_GLSL + `
 *   // map noise output [0,1] to hue range [0.5, 0.8]
 *   float hue = remap(noiseVal, 0.0, 1.0, 0.5, 0.8);
 * `
 * ```
 */
export const REMAP_GLSL: string = `
float remap(float v, float inMin, float inMax, float outMin, float outMax) {
  return outMin + (v - inMin) / (inMax - inMin) * (outMax - outMin);
}
`

/**
 * GLSL string defining
 * `float smoothstepCustom(float edge0, float edge1, float x)`.
 *
 * Returns a smooth Hermite interpolation of `x` between `edge0` and `edge1`,
 * clamped to [0, 1]. Uses the standard 3t² − 2t³ polynomial with an explicit
 * name to avoid ambiguity with the GLSL built-in `smoothstep`.
 *
 * @remarks
 * Identical in behaviour to GLSL's built-in `smoothstep` but defined as a
 * user function so that it can be inlined, overloaded, or modified without
 * conflicting with the built-in name reserved by the GLSL spec.
 *
 * @example
 * ```ts
 * const fragSrc = SMOOTHSTEP_GLSL + `
 *   // smooth vignette at edges
 *   float edge = smoothstepCustom(0.0, 0.2, length(vUv - 0.5));
 * `
 * ```
 */
export const SMOOTHSTEP_GLSL: string = `
float smoothstepCustom(float edge0, float edge1, float x) {
  float t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}
`

/**
 * GLSL string defining `mat2 rotate2d(float angle)`.
 *
 * Returns the 2×2 rotation matrix for a counter-clockwise rotation by
 * `angle` radians. Multiply a `vec2` by this matrix to rotate it in place.
 *
 * @example
 * ```ts
 * const fragSrc = ROTATE2D_GLSL + `
 *   // rotate UV coordinates by 45 degrees
 *   vec2 rotated = rotate2d(radians(45.0)) * (vUv - 0.5);
 * `
 * ```
 */
export const ROTATE2D_GLSL: string = `
mat2 rotate2d(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}
`
