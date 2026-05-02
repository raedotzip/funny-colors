/**
 * @fileoverview WebGL2 context lifecycle for `@funny-colors/renderer`.
 *
 * Provides {@link createWebGLContext} — a thin wrapper around
 * `HTMLCanvasElement.getContext('webgl2')` that throws a typed error on
 * failure and returns a handle with a `destroy` method for clean teardown.
 *
 * @see {@link createWebGLContext}
 * @see {@link WebGLContextHandle}
 * @see {@link WebGLNotSupportedError}
 *
 * @module
 */

/**
 * An active WebGL2 context bound to a canvas, with a `destroy` method for
 * clean teardown.
 *
 * Returned by {@link createWebGLContext}. The `gl` field is the raw
 * `WebGL2RenderingContext` — pass it to shader compilation and draw calls.
 *
 * @remarks
 * `destroy` uses the `WEBGL_lose_context` extension when available. In
 * environments where the extension is absent (some headless test runners)
 * the call is a no-op — context cleanup falls back to the browser's GC.
 *
 * @example
 * ```ts
 * const handle = createWebGLContext(canvas)
 * handle.gl.clearColor(0, 0, 0, 1)
 * // ... draw calls ...
 * handle.destroy()
 * ```
 *
 * @see {@link createWebGLContext}
 */
export interface WebGLContextHandle {
  /** The live WebGL2 rendering context. */
  gl: WebGL2RenderingContext
  /**
   * Releases the WebGL2 context via `WEBGL_lose_context` and marks the
   * canvas as context-lost. Safe to call when the extension is unavailable
   * (the optional chain makes it a no-op).
   */
  destroy(): void
}

/**
 * Thrown by {@link createWebGLContext} when the browser cannot provide a
 * `WebGL2RenderingContext` for the given canvas.
 *
 * This happens when: the browser does not support WebGL2, the OS/driver has
 * exhausted its context limit (~16 per page in most browsers), or the page
 * is running in a WebGL-disabled environment (some headless runners,
 * enhanced privacy modes).
 *
 * @example
 * ```ts
 * import { createWebGLContext, WebGLNotSupportedError } from '@funny-colors/renderer'
 *
 * try {
 *   const handle = createWebGLContext(canvas)
 * } catch (e) {
 *   if (e instanceof WebGLNotSupportedError) {
 *     showFallback()
 *   }
 * }
 * ```
 */
export class WebGLNotSupportedError extends Error {
  /** Stable machine-readable code. Never changes across patch/minor versions. */
  readonly code = 'WEBGL_NOT_SUPPORTED' as const

  constructor() {
    super('WebGL2 is not supported in this environment')
    this.name = 'WebGLNotSupportedError'
  }
}

/**
 * Acquires a `WebGL2RenderingContext` from `canvas` and returns it inside a
 * {@link WebGLContextHandle} with a `destroy` method for clean teardown.
 *
 * @param canvas - The `<canvas>` element to acquire the context from.
 * @returns A {@link WebGLContextHandle} whose `gl` field is ready for draw calls.
 * @throws {WebGLNotSupportedError} When `canvas.getContext('webgl2')` returns `null`.
 *
 * @example
 * ```ts
 * const { gl, destroy } = createWebGLContext(canvas)
 * gl.clearColor(0, 0, 0, 1)
 * gl.clear(gl.COLOR_BUFFER_BIT)
 * destroy()
 * ```
 */
export function createWebGLContext(canvas: HTMLCanvasElement): WebGLContextHandle {
  const gl = canvas.getContext('webgl2')
  if (!gl) throw new WebGLNotSupportedError()
  return {
    gl,
    destroy() {
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
}
