/**
 * @fileoverview Renderer backend abstraction for `@funny-colors/renderer`.
 *
 * Defines the two-interface contract between the DAG compiler and any
 * graphics-API backend. {@link WebGLBackend} is the current implementation;
 * a future WebGPU backend would implement the same interfaces without
 * changing any caller code.
 *
 * **Dependency rule:** This module imports from nothing. All other renderer
 * modules import from here. These interfaces must not be modified after Phase 3
 * ships — downstream packages depend on them directly.
 *
 * @see {@link RendererBackend}
 * @see {@link CompiledProgram}
 * @see {@link WebGLBackend}
 *
 * @module
 */

/**
 * The IR abstraction between the DAG compiler and the graphics API.
 *
 * Implement this interface to add a new rendering backend (e.g. WebGPU,
 * OffscreenCanvas, or a headless test stub). The DAG runtime depends only
 * on `RendererBackend` — it never imports from `webgl/` directly.
 *
 * @remarks
 * A single `RendererBackend` instance may be reused across multiple `compile`
 * calls (one instance per page with multiple canvases, for example). Each
 * `compile` call returns an independent {@link CompiledProgram} that owns its
 * own GPU resources and context.
 *
 * @example
 * ```ts
 * import { WebGLBackend } from '@funny-colors/renderer'
 *
 * const backend: RendererBackend = new WebGLBackend()
 * const program = backend.compile(canvas, fragSource)
 * program.render({ u_time: 1.5 })
 * program.destroy()
 * backend.destroy()
 * ```
 *
 * @see {@link CompiledProgram}
 * @see {@link WebGLBackend}
 */
export interface RendererBackend {
  /**
   * Compiles a fragment shader source string and binds it to `canvas`,
   * returning an opaque handle to the compiled GPU program.
   *
   * The backend supplies its own vertex shader — callers provide only the
   * fragment shader. `source` must be valid GLSL 300 es.
   *
   * @param canvas - The `<canvas>` element to render into. The backend
   *   acquires a WebGL2 context from it and holds it for the lifetime of
   *   the returned {@link CompiledProgram}.
   * @param source - A complete GLSL 300 es fragment shader source string.
   * @returns An opaque handle. Call {@link CompiledProgram.render} each
   *   frame and {@link CompiledProgram.destroy} when the canvas is torn down.
   * @throws {WebGLNotSupportedError} When the browser does not support WebGL2.
   * @throws {ShaderCompileError} When `source` contains a GLSL compile error.
   *
   * @example
   * ```ts
   * const program = backend.compile(canvas, `
   *   #version 300 es
   *   precision mediump float;
   *   in vec2 vUv;
   *   uniform float u_time;
   *   out vec4 fragColor;
   *   void main() { fragColor = vec4(vUv, sin(u_time) * 0.5 + 0.5, 1.0); }
   * `)
   * ```
   */
  compile(canvas: HTMLCanvasElement, source: string): CompiledProgram
  /**
   * Releases all GPU resources and WebGL contexts held by the backend.
   *
   * Must be called when the background is torn down to prevent context leaks.
   * After calling `destroy`, the `RendererBackend` must not be used again.
   */
  destroy(): void
}

/**
 * Opaque handle to a compiled GPU program bound to a specific canvas.
 *
 * Returned by {@link RendererBackend.compile}. Call {@link render} on every
 * animation frame and {@link destroy} when the canvas is unmounted.
 *
 * @remarks
 * The program holds a live WebGL2 context. Keeping unused programs alive
 * wastes GPU memory and may exhaust the browser's context limit (~16 per page
 * in most browsers). Always call {@link destroy} when the associated canvas
 * is removed from the DOM.
 *
 * @example
 * ```ts
 * function frame(time: number) {
 *   program.render({ u_time: time / 1000, u_resolution: [canvas.width, canvas.height] })
 *   requestAnimationFrame(frame)
 * }
 * requestAnimationFrame(frame)
 * ```
 *
 * @see {@link RendererBackend}
 */
export interface CompiledProgram {
  /**
   * Draws one frame to the canvas using the given uniform values.
   *
   * Binds the program, uploads each uniform, draws a fullscreen triangle,
   * and flushes the command buffer. Uniforms not present in the shader are
   * silently ignored — no error is thrown for a missing uniform location.
   *
   * @param uniforms - Map of uniform name → value. Accepted value types:
   *   `number` → `uniform1f`, `[n,n]` → `uniform2fv`, `[n,n,n]` → `uniform3fv`,
   *   `[n,n,n,n]` → `uniform4fv`, `Float32Array(16)` → `uniformMatrix4fv`,
   *   other `Float32Array` → `uniform1fv`.
   *
   * @example
   * ```ts
   * program.render({
   *   u_time: elapsed,
   *   u_resolution: [canvas.width, canvas.height],
   *   u_mouse: [mx, my],
   * })
   * ```
   */
  render(uniforms: Record<string, unknown>): void
  /**
   * Deletes the underlying GPU program object and releases associated memory.
   *
   * After calling `destroy`, the `CompiledProgram` must not be used again.
   */
  destroy(): void
}
