/**
 * @fileoverview WebGL2 renderer backend for `@funny-colors/renderer`.
 *
 * Exports {@link WebGLBackend} — the concrete {@link RendererBackend}
 * implementation that renders via `WebGL2RenderingContext`. It uses a
 * fullscreen triangle generated from `gl_VertexID` (no VAO or VBO required).
 *
 * @remarks
 * The vertex shader covers the entire clip-space viewport with three vertices
 * at (-1,-1), (3,-1), and (-1,3). This is the standard "fullscreen triangle"
 * technique: all three vertices lie outside the (-1,1) clip cube on at least
 * one axis, but together they enclose the entire NDC square.
 *
 * @see {@link WebGLBackend}
 * @see {@link RendererBackend}
 *
 * @module
 */

import type { RendererBackend, CompiledProgram } from '../backend.js'
import { createWebGLContext, type WebGLContextHandle } from './context.js'
import { createShaderProgram, type ShaderProgram } from './program.js'

const VERT_SRC = `#version 300 es
out vec2 vUv;
void main() {
  vec2 pos = vec2(
    float(gl_VertexID & 1) * 4.0 - 1.0,
    float((gl_VertexID >> 1) & 1) * 4.0 - 1.0
  );
  vUv = pos * 0.5 + 0.5;
  gl_Position = vec4(pos, 0.0, 1.0);
}`

/**
 * WebGL2 implementation of {@link RendererBackend}.
 *
 * Compiles a caller-supplied fragment shader alongside a built-in fullscreen
 * vertex shader, then renders one triangle per frame that covers the entire
 * canvas. The caller communicates per-frame data (time, resolution, mouse)
 * via the `uniforms` map passed to {@link CompiledProgram.render}.
 *
 * @remarks
 * **Context ownership:** Each {@link compile} call acquires a new
 * `WebGL2RenderingContext` from the canvas and stores it internally.
 * The context is released when {@link destroy} is called on the backend or
 * on the returned {@link CompiledProgram}.
 *
 * **Vertex shader:** The built-in vertex shader uses `gl_VertexID` to
 * generate a fullscreen triangle with no buffer objects. It emits a `vUv`
 * varying in the range [0,1] that fragment shaders can use as a UV coordinate.
 *
 * @example
 * ```ts
 * import { WebGLBackend } from '@funny-colors/renderer'
 *
 * const backend = new WebGLBackend()
 * const program = backend.compile(canvas, fragSrc)
 *
 * function frame(t: number) {
 *   program.render({ u_time: t / 1000, u_resolution: [canvas.width, canvas.height] })
 *   requestAnimationFrame(frame)
 * }
 * requestAnimationFrame(frame)
 * ```
 *
 * @see {@link RendererBackend}
 * @see {@link CompiledProgram}
 */
export class WebGLBackend implements RendererBackend {
  /** The context handle acquired during the most recent {@link compile} call. */
  private contextHandle: WebGLContextHandle | null = null

  /**
   * Compiles `fragSrc` against the built-in fullscreen vertex shader and
   * returns a {@link CompiledProgram} bound to `canvas`.
   *
   * @param canvas - The `<canvas>` element to render into.
   * @param fragSrc - Complete GLSL 300 es fragment shader source. Must declare
   *   `precision`, read `in vec2 vUv`, and write to `out vec4 fragColor`.
   * @returns A {@link CompiledProgram} ready for `render()` calls.
   * @throws {WebGLNotSupportedError} When the browser does not support WebGL2.
   * @throws {ShaderCompileError} When `fragSrc` fails to compile or link.
   *
   * @example
   * ```ts
   * const prog = backend.compile(canvas, `
   *   #version 300 es
   *   precision mediump float;
   *   in vec2 vUv;
   *   out vec4 fragColor;
   *   void main() { fragColor = vec4(vUv, 0.0, 1.0); }
   * `)
   * ```
   */
  compile(canvas: HTMLCanvasElement, fragSrc: string): CompiledProgram {
    const handle = createWebGLContext(canvas)
    this.contextHandle = handle
    const { gl } = handle

    const program = createShaderProgram(gl, VERT_SRC, fragSrc)

    return {
      render(uniforms: Record<string, unknown>) {
        program.use()
        for (const [name, value] of Object.entries(uniforms)) {
          if (
            typeof value === 'number' ||
            value instanceof Float32Array ||
            Array.isArray(value)
          ) {
            program.setUniform(name, value as Parameters<ShaderProgram['setUniform']>[1])
          }
        }
        gl.drawArrays(gl.TRIANGLES, 0, 3)
        gl.flush()
      },

      destroy() {
        program.destroy()
      },
    }
  }

  /**
   * Releases the WebGL2 context acquired during the last {@link compile} call.
   *
   * Safe to call when no `compile` has been performed (no-op). After calling
   * `destroy`, the `WebGLBackend` must not be used again.
   */
  destroy(): void {
    this.contextHandle?.destroy()
    this.contextHandle = null
  }
}
