/**
 * @fileoverview Barrel export for all GLSL math helpers in `@funny-colors/renderer`.
 *
 * Re-exports every noise, color, and math GLSL constant from the three
 * sub-modules. Import from this path to get the full math surface:
 *
 * ```ts
 * import { FBM_GLSL, HSV_TO_RGB_GLSL, REMAP_GLSL } from '@funny-colors/renderer'
 * ```
 *
 * @see {@link FBM_GLSL}
 * @see {@link HSV_TO_RGB_GLSL}
 * @see {@link REMAP_GLSL}
 *
 * @module
 */

export * from './noise/index.js'
export * from './color/index.js'
export * from './math/index.js'
