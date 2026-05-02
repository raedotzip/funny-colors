/**
 * @fileoverview GLSL shader compilation and uniform dispatch for `@funny-colors/renderer`.
 *
 * Provides {@link createShaderProgram} — a function that compiles a vertex +
 * fragment source pair into a linked WebGL program and returns a
 * {@link ShaderProgram} handle with typed `setUniform` dispatch.
 *
 * Errors are typed: {@link ShaderCompileError} carries a `stage` field
 * (`'vertex'`, `'fragment'`, or `'link'`) so callers can surface the
 * relevant driver info log without additional parsing.
 *
 * @see {@link createShaderProgram}
 * @see {@link ShaderProgram}
 * @see {@link ShaderCompileError}
 * @see {@link UniformValue}
 *
 * @module
 */

/**
 * The set of value types accepted by {@link ShaderProgram.setUniform}.
 *
 * Each variant maps to a distinct WebGL uniform setter:
 * - `number` → `gl.uniform1f`
 * - `[n, n]` → `gl.uniform2fv`
 * - `[n, n, n]` → `gl.uniform3fv`
 * - `[n, n, n, n]` → `gl.uniform4fv`
 * - `Float32Array` of length 16 → `gl.uniformMatrix4fv`
 * - other `Float32Array` → `gl.uniform1fv`
 *
 * @see {@link ShaderProgram.setUniform}
 */
export type UniformValue =
  | number
  | [number, number]
  | [number, number, number]
  | [number, number, number, number]
  | Float32Array

/**
 * An active linked WebGL program with typed uniform upload and a `destroy` method.
 *
 * Returned by {@link createShaderProgram}. Call {@link use} before setting
 * uniforms, then issue draw calls on the same `WebGL2RenderingContext`.
 *
 * @example
 * ```ts
 * const prog = createShaderProgram(gl, vertSrc, fragSrc)
 * prog.use()
 * prog.setUniform('u_time', 1.5)
 * prog.setUniform('u_resolution', [640, 480])
 * gl.drawArrays(gl.TRIANGLES, 0, 3)
 * prog.destroy()
 * ```
 *
 * @see {@link createShaderProgram}
 * @see {@link UniformValue}
 */
export interface ShaderProgram {
  /** Binds this program as the active WebGL program (`gl.useProgram`). */
  use(): void
  /**
   * Uploads a uniform value to the shader.
   *
   * Silently ignores uniforms that do not exist in the linked program
   * (`gl.getUniformLocation` returning `null`). This matches the WebGL spec
   * and avoids noise when the caller passes a superset of uniforms.
   *
   * @param name - The uniform name as declared in the GLSL source.
   * @param value - The value to upload. Dispatch is by type — see {@link UniformValue}.
   */
  setUniform(name: string, value: UniformValue): void
  /**
   * Deletes the underlying `WebGLProgram` and releases GPU memory.
   * Must not be called while a draw call is in-flight.
   */
  destroy(): void
}

/**
 * Thrown by {@link createShaderProgram} when a shader stage fails to compile
 * or the program fails to link.
 *
 * The `stage` field identifies exactly where the error occurred so callers
 * can surface the driver info log without parsing it themselves.
 *
 * @example
 * ```ts
 * import { createShaderProgram, ShaderCompileError } from '@funny-colors/renderer'
 *
 * try {
 *   createShaderProgram(gl, vertSrc, badFragSrc)
 * } catch (e) {
 *   if (e instanceof ShaderCompileError) {
 *     console.error(`GLSL error in ${e.stage} stage: ${e.message}`)
 *   }
 * }
 * ```
 */
export class ShaderCompileError extends Error {
  /** Stable machine-readable code. Never changes across patch/minor versions. */
  readonly code = 'SHADER_COMPILE_ERROR' as const

  /**
   * @param stage - Which compilation step failed.
   * @param message - The raw GLSL info log from the driver.
   */
  constructor(
    /**
     * The pipeline stage that produced the error.
     * - `'vertex'` — vertex shader `gl.compileShader` failed.
     * - `'fragment'` — fragment shader `gl.compileShader` failed.
     * - `'link'` — `gl.linkProgram` failed after both shaders compiled.
     */
    public readonly stage: 'vertex' | 'fragment' | 'link',
    message: string,
  ) {
    super(`Shader ${stage} error: ${message}`)
    this.name = 'ShaderCompileError'
  }
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
  stage: 'vertex' | 'fragment',
): WebGLShader {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'unknown error'
    gl.deleteShader(shader)
    throw new ShaderCompileError(stage, log)
  }
  return shader
}

/**
 * Compiles `vertSrc` and `fragSrc` into a linked WebGL program and returns a
 * {@link ShaderProgram} handle with typed uniform dispatch.
 *
 * Intermediate shader objects are deleted immediately after linking — the
 * returned handle holds only the linked `WebGLProgram`.
 *
 * @param gl - The WebGL2 rendering context to compile on.
 * @param vertSrc - Complete GLSL 300 es vertex shader source.
 * @param fragSrc - Complete GLSL 300 es fragment shader source.
 * @returns A {@link ShaderProgram} ready for `use()` + draw calls.
 * @throws {ShaderCompileError} When either shader fails to compile or the
 *   program fails to link. The `stage` field identifies which step failed.
 *
 * @example
 * ```ts
 * const prog = createShaderProgram(gl, vertSrc, fragSrc)
 * prog.use()
 * prog.setUniform('u_time', elapsed)
 * gl.drawArrays(gl.TRIANGLES, 0, 3)
 * ```
 */
export function createShaderProgram(
  gl: WebGL2RenderingContext,
  vertSrc: string,
  fragSrc: string,
): ShaderProgram {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc, 'vertex')
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc, 'fragment')

  const program = gl.createProgram()!
  gl.attachShader(program, vert)
  gl.attachShader(program, frag)
  gl.linkProgram(program)
  gl.deleteShader(vert)
  gl.deleteShader(frag)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'unknown error'
    gl.deleteProgram(program)
    throw new ShaderCompileError('link', log)
  }

  return {
    use() {
      gl.useProgram(program)
    },

    setUniform(name: string, value: UniformValue) {
      const loc = gl.getUniformLocation(program, name)
      if (loc === null) return
      if (typeof value === 'number') {
        gl.uniform1f(loc, value)
      } else if (value instanceof Float32Array) {
        if (value.length === 16) {
          gl.uniformMatrix4fv(loc, false, value)
        } else {
          gl.uniform1fv(loc, value)
        }
      } else if (value.length === 2) {
        gl.uniform2fv(loc, value)
      } else if (value.length === 3) {
        gl.uniform3fv(loc, value)
      } else {
        gl.uniform4fv(loc, value)
      }
    },

    destroy() {
      gl.deleteProgram(program)
    },
  }
}
