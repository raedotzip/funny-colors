/**
 * @fileoverview Color space conversion GLSL helpers for `@funny-colors/renderer`.
 *
 * Each export is a self-contained GLSL 300 es string ready to be prepended to
 * a fragment shader. Functions have no external dependencies — they can be
 * concatenated in any order.
 *
 * @remarks
 * Linear ↔ sRGB conversions follow the IEC 61966-2-1 standard piecewise
 * formula. HSV ↔ RGB conversions use the classic Kizzles / iq formulations
 * that avoid branching by encoding the hue segments as swizzle operations.
 *
 * @see {@link HSV_TO_RGB_GLSL}
 * @see {@link RGB_TO_HSV_GLSL}
 * @see {@link LINEAR_TO_SRGB_GLSL}
 * @see {@link SRGB_TO_LINEAR_GLSL}
 *
 * @module
 */

/**
 * GLSL string defining `vec3 hsv2rgb(vec3 c)`.
 *
 * Converts a colour from HSV (hue, saturation, value) to linear RGB. All
 * components are expected in the range [0, 1]. Uses a branchless swizzle
 * formulation to avoid `if` statements in the shader.
 *
 * @remarks
 * The output is linear RGB — apply {@link LINEAR_TO_SRGB_GLSL} before
 * writing to `fragColor` if the canvas framebuffer is sRGB-encoded.
 *
 * @example
 * ```ts
 * // Prepend to fragment shader source:
 * const fragSrc = HSV_TO_RGB_GLSL + `
 *   #version 300 es
 *   precision mediump float;
 *   out vec4 fragColor;
 *   void main() {
 *     fragColor = vec4(hsv2rgb(vec3(0.6, 0.8, 1.0)), 1.0);
 *   }
 * `
 * ```
 *
 * @see {@link RGB_TO_HSV_GLSL}
 */
export const HSV_TO_RGB_GLSL: string = `
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
`

/**
 * GLSL string defining `vec3 rgb2hsv(vec3 c)`.
 *
 * Converts a colour from linear RGB to HSV. Input components must be in
 * [0, 1]. Returns HSV with all components in [0, 1]. Uses an epsilon
 * (`1.0e-10`) to avoid division-by-zero for achromatic colours.
 *
 * @remarks
 * Pairs with {@link HSV_TO_RGB_GLSL} for round-trip conversions. Round-trip
 * error is below 1% for colours with saturation > 0.1.
 *
 * @example
 * ```ts
 * const fragSrc = RGB_TO_HSV_GLSL + HSV_TO_RGB_GLSL + `
 *   // ... rotate hue by 0.1 ...
 *   vec3 hsv = rgb2hsv(inputColor);
 *   hsv.x = fract(hsv.x + 0.1);
 *   vec3 rgb = hsv2rgb(hsv);
 * `
 * ```
 *
 * @see {@link HSV_TO_RGB_GLSL}
 */
export const RGB_TO_HSV_GLSL: string = `
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
`

/**
 * GLSL string defining `float linearToSrgb(float v)` and
 * `vec3 linearToSrgb(vec3 c)`.
 *
 * Applies the IEC 61966-2-1 piecewise gamma curve to convert a linear-light
 * value to the sRGB encoded value. Both scalar and vec3 overloads are
 * included so callers can operate per-channel or on a full colour at once.
 *
 * @remarks
 * Use this before writing to `fragColor` when the display is sRGB (most
 * browsers assume sRGB output). Skipping this step causes colours to appear
 * washed out because linear values are darker than their sRGB equivalents.
 *
 * Threshold: values ≤ 0.0031308 use the linear segment `v × 12.92`; above
 * that, the power-law segment `1.055 × v^(1/2.4) − 0.055` is used.
 *
 * @example
 * ```ts
 * const fragSrc = LINEAR_TO_SRGB_GLSL + `
 *   // convert linear result before output
 *   fragColor = vec4(linearToSrgb(linearColor), 1.0);
 * `
 * ```
 *
 * @see {@link SRGB_TO_LINEAR_GLSL}
 */
export const LINEAR_TO_SRGB_GLSL: string = `
float linearToSrgb(float v) {
  return v <= 0.0031308
    ? v * 12.92
    : 1.055 * pow(v, 1.0 / 2.4) - 0.055;
}

vec3 linearToSrgb(vec3 c) {
  return vec3(linearToSrgb(c.r), linearToSrgb(c.g), linearToSrgb(c.b));
}
`

/**
 * GLSL string defining `float srgbToLinear(float v)` and
 * `vec3 srgbToLinear(vec3 c)`.
 *
 * Applies the inverse IEC 61966-2-1 gamma curve to decode an sRGB-encoded
 * value into a linear-light value. Both scalar and vec3 overloads are included.
 *
 * @remarks
 * Use this when reading a texture that was stored in sRGB encoding before
 * performing colour math in the shader. Performing arithmetic in sRGB space
 * produces physically incorrect blending and lighting results.
 *
 * Threshold: values ≤ 0.04045 use the linear segment `v / 12.92`; above
 * that, `((v + 0.055) / 1.055)^2.4` is used.
 *
 * @example
 * ```ts
 * const fragSrc = SRGB_TO_LINEAR_GLSL + LINEAR_TO_SRGB_GLSL + `
 *   // decode → process in linear → re-encode
 *   vec3 linear = srgbToLinear(textureSample);
 *   vec3 result = doColorMath(linear);
 *   fragColor = vec4(linearToSrgb(result), 1.0);
 * `
 * ```
 *
 * @see {@link LINEAR_TO_SRGB_GLSL}
 */
export const SRGB_TO_LINEAR_GLSL: string = `
float srgbToLinear(float v) {
  return v <= 0.04045
    ? v / 12.92
    : pow((v + 0.055) / 1.055, 2.4);
}

vec3 srgbToLinear(vec3 c) {
  return vec3(srgbToLinear(c.r), srgbToLinear(c.g), srgbToLinear(c.b));
}
`
