/**
 * @fileoverview Procedural noise GLSL helpers for `@funny-colors/renderer`.
 *
 * Each export is a self-contained GLSL 300 es string ready to be prepended to
 * a fragment shader. All helper functions are included in the same string as
 * the public entry point so callers need only concatenate the single constant.
 *
 * @remarks
 * Output ranges differ by algorithm:
 * - {@link FBM_GLSL} — `fbm(vec2)` returns approximately [0, 1]
 * - {@link SIMPLEX_GLSL} — `simplex(vec2)` returns approximately [-1, 1]
 * - {@link WORLEY_GLSL} — `worley(vec2)` returns [0, 1] (minimum cell distance)
 *
 * @see {@link FBM_GLSL}
 * @see {@link SIMPLEX_GLSL}
 * @see {@link WORLEY_GLSL}
 *
 * @module
 */

/**
 * GLSL string defining `float fbm(vec2 p)`.
 *
 * Fractional Brownian motion built on a value-noise base. Accumulates 6
 * octaves with amplitude halved and frequency doubled each iteration. A
 * small rotation is applied between octaves to break up axis-aligned
 * artefacts.
 *
 * @remarks
 * Also defines the internal helpers `hash(vec2)` and `valueNoise(vec2)`.
 * These are not namespaced — avoid naming conflicts if concatenating
 * multiple noise strings in the same shader.
 *
 * Output is in approximately [0, 1]; exact range depends on the octave
 * accumulation but values outside [0.05, 0.95] are uncommon.
 *
 * @example
 * ```ts
 * const fragSrc = FBM_GLSL + `
 *   #version 300 es
 *   precision mediump float;
 *   in vec2 vUv;
 *   uniform float u_time;
 *   out vec4 fragColor;
 *   void main() {
 *     float n = fbm(vUv * 3.0 + u_time * 0.1);
 *     fragColor = vec4(vec3(n), 1.0);
 *   }
 * `
 * ```
 */
export const FBM_GLSL: string = `
float hash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0,0)), hash(i + vec2(1,0)), u.x),
    mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 6; i++) {
    v += a * valueNoise(p);
    p = rot * p * 2.0 + vec2(5.1, 1.7);
    a *= 0.5;
  }
  return v;
}
`

/**
 * GLSL string defining `float simplex(vec2 v)`.
 *
 * 2D Simplex noise based on the Ashima Arts / Stefan Gustavson public
 * domain implementation. Returns a value in approximately [-1, 1] with
 * good isotropy and a smooth power spectrum.
 *
 * @remarks
 * Also defines the internal helper `simplexPermute(vec3)`. Avoid naming
 * conflicts when concatenating with other noise strings in the same shader.
 *
 * To map the output to [0, 1] for use as a colour or mask, apply
 * `v * 0.5 + 0.5`.
 *
 * @example
 * ```ts
 * const fragSrc = SIMPLEX_GLSL + `
 *   float n = simplex(vUv * 4.0) * 0.5 + 0.5; // remap to [0,1]
 *   fragColor = vec4(vec3(n), 1.0);
 * `
 * ```
 */
export const SIMPLEX_GLSL: string = `
vec3 simplexPermute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float simplex(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                      -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = simplexPermute(
    simplexPermute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0)
  );
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
`

/**
 * GLSL string defining `float worley(vec2 p)`.
 *
 * Worley (cellular) noise. Returns the distance from `p` to the nearest
 * cell feature point in the range [0, 1]. Cell points are randomised per
 * integer cell and animated via a `sin`-based jitter so they sit near the
 * centre of each cell rather than clustering at the corners.
 *
 * @remarks
 * Also defines the internal helper `worleyHash(vec2)`. Avoid naming
 * conflicts when concatenating with other noise strings in the same shader.
 *
 * Larger output values indicate points far from any cell centre (interstitial
 * regions). Use `1.0 - worley(p)` to invert (bright spots at cell centres).
 *
 * @example
 * ```ts
 * const fragSrc = WORLEY_GLSL + `
 *   float n = worley(vUv * 6.0);
 *   fragColor = vec4(vec3(1.0 - n), 1.0); // bright cell centres
 * `
 * ```
 */
export const WORLEY_GLSL: string = `
vec2 worleyHash(vec2 p) {
  p = vec2(
    dot(p, vec2(127.1, 311.7)),
    dot(p, vec2(269.5, 183.3))
  );
  return fract(sin(p) * 43758.5453);
}

float worley(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float minDist = 1.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 point = worleyHash(i + neighbor);
      point = 0.5 + 0.5 * sin(6.2831 * point);
      vec2 diff = neighbor + point - f;
      float dist = length(diff);
      minDist = min(minDist, dist);
    }
  }
  return minDist;
}
`
