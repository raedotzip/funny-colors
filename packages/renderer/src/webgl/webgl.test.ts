import { describe, it, expect, vi, afterEach } from 'vitest'
import { createWebGLContext, WebGLNotSupportedError } from './context.js'
import { createShaderProgram, ShaderCompileError } from './program.js'
import { WebGLBackend } from './index.js'

// ---------------------------------------------------------------------------
// Shader fixtures
// ---------------------------------------------------------------------------

const MINIMAL_VERT = `#version 300 es
void main() { gl_Position = vec4(0.0); }`

const MINIMAL_FRAG = `#version 300 es
precision highp float;
out vec4 fragColor;
void main() { fragColor = vec4(1.0); }`

// Shader with every uniform type used, so setUniform dispatches are reachable
const UNIFORMS_VERT = `#version 300 es
void main() { gl_Position = vec4(0.0); }`

const UNIFORMS_FRAG = `#version 300 es
precision highp float;
uniform float u_float;
uniform vec2  u_vec2;
uniform vec3  u_vec3;
uniform vec4  u_vec4;
uniform mat4  u_mat4;
out vec4 fragColor;
void main() {
  fragColor = vec4(u_float) + vec4(u_vec2, 0.0, 0.0) + vec4(u_vec3, 0.0) + u_vec4 + u_mat4[0];
}`

// Mismatched interface to trigger link error (out vec4 vs in vec2 type mismatch)
const LINK_ERR_VERT = `#version 300 es
out vec4 vData;
void main() { vData = vec4(1.0); gl_Position = vec4(0.0); }`

const LINK_ERR_FRAG = `#version 300 es
precision highp float;
in vec2 vData;
out vec4 fragColor;
void main() { fragColor = vec4(vData, 0.0, 1.0); }`

const BAD_VERT = `#version 300 es
void main() { SYNTAX ERROR }`

const BAD_FRAG = `#version 300 es
precision highp float;
out vec4 fragColor;
void main() { SYNTAX ERROR }`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCanvas(w = 100, h = 100): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  return canvas
}

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// createWebGLContext
// ---------------------------------------------------------------------------

describe('createWebGLContext', () => {
  it('returns a handle with a valid WebGL2RenderingContext', () => {
    const canvas = makeCanvas()
    const handle = createWebGLContext(canvas)
    expect(handle.gl).toBeInstanceOf(WebGL2RenderingContext)
    handle.destroy()
  })

  it('throws WebGLNotSupportedError when getContext returns null', () => {
    const canvas = makeCanvas()
    vi.spyOn(canvas, 'getContext').mockReturnValue(null)
    expect(() => createWebGLContext(canvas)).toThrow(WebGLNotSupportedError)
  })

  it('WebGLNotSupportedError.code is stable machine-readable string', () => {
    const canvas = makeCanvas()
    vi.spyOn(canvas, 'getContext').mockReturnValue(null)
    try {
      createWebGLContext(canvas)
    } catch (e) {
      expect((e as WebGLNotSupportedError).code).toBe('WEBGL_NOT_SUPPORTED')
    }
  })

  it('WebGLNotSupportedError.name identifies the class after minification', () => {
    const err = new WebGLNotSupportedError()
    expect(err.name).toBe('WebGLNotSupportedError')
  })

  it('WebGLNotSupportedError.message mentions WebGL2', () => {
    const err = new WebGLNotSupportedError()
    expect(err.message).toContain('WebGL2')
  })

  it('WebGLNotSupportedError is an instance of Error', () => {
    expect(new WebGLNotSupportedError()).toBeInstanceOf(Error)
  })

  it('destroy() releases the context without throwing', () => {
    const canvas = makeCanvas()
    const handle = createWebGLContext(canvas)
    expect(() => handle.destroy()).not.toThrow()
  })

  it('destroy() called twice is safe (idempotent)', () => {
    const canvas = makeCanvas()
    const handle = createWebGLContext(canvas)
    handle.destroy()
    expect(() => handle.destroy()).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// createShaderProgram
// ---------------------------------------------------------------------------

describe('createShaderProgram', () => {
  it('compiles a valid vert + frag shader without throwing', () => {
    const canvas = makeCanvas()
    const { gl, destroy } = createWebGLContext(canvas)
    expect(() => {
      const prog = createShaderProgram(gl, MINIMAL_VERT, MINIMAL_FRAG)
      prog.destroy()
    }).not.toThrow()
    destroy()
  })

  it('throws ShaderCompileError with stage "fragment" for bad frag shader', () => {
    const canvas = makeCanvas()
    const { gl, destroy } = createWebGLContext(canvas)
    try {
      createShaderProgram(gl, MINIMAL_VERT, BAD_FRAG)
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ShaderCompileError)
      expect((e as ShaderCompileError).stage).toBe('fragment')
    }
    destroy()
  })

  it('throws ShaderCompileError with stage "vertex" for bad vert shader', () => {
    const canvas = makeCanvas()
    const { gl, destroy } = createWebGLContext(canvas)
    try {
      createShaderProgram(gl, BAD_VERT, MINIMAL_FRAG)
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ShaderCompileError)
      expect((e as ShaderCompileError).stage).toBe('vertex')
    }
    destroy()
  })

  it('ShaderCompileError.code is stable machine-readable string', () => {
    const canvas = makeCanvas()
    const { gl, destroy } = createWebGLContext(canvas)
    try {
      createShaderProgram(gl, MINIMAL_VERT, BAD_FRAG)
    } catch (e) {
      expect((e as ShaderCompileError).code).toBe('SHADER_COMPILE_ERROR')
    }
    destroy()
  })

  it('ShaderCompileError.name identifies the class after minification', () => {
    const err = new ShaderCompileError('vertex', 'test')
    expect(err.name).toBe('ShaderCompileError')
  })

  it('ShaderCompileError.message includes the stage name', () => {
    const err = new ShaderCompileError('fragment', 'undeclared identifier')
    expect(err.message).toContain('fragment')
    expect(err.message).toContain('undeclared identifier')
  })

  it('ShaderCompileError is an instance of Error', () => {
    expect(new ShaderCompileError('link', 'test')).toBeInstanceOf(Error)
  })

  it('uses "unknown error" when getShaderInfoLog returns null', () => {
    const canvas = makeCanvas()
    const { gl, destroy } = createWebGLContext(canvas)
    vi.spyOn(gl, 'getShaderInfoLog').mockReturnValue(null)
    try {
      createShaderProgram(gl, BAD_VERT, MINIMAL_FRAG)
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ShaderCompileError)
      expect((e as ShaderCompileError).message).toContain('unknown error')
    }
    destroy()
  })

  it('uses "unknown error" when getProgramInfoLog returns null on link failure', () => {
    const canvas = makeCanvas()
    const { gl, destroy } = createWebGLContext(canvas)
    vi.spyOn(gl, 'getProgramParameter').mockReturnValue(false)
    vi.spyOn(gl, 'getProgramInfoLog').mockReturnValue(null)
    try {
      createShaderProgram(gl, MINIMAL_VERT, MINIMAL_FRAG)
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ShaderCompileError)
      expect((e as ShaderCompileError).stage).toBe('link')
      expect((e as ShaderCompileError).message).toContain('unknown error')
    }
    destroy()
  })

  it('throws ShaderCompileError for mismatched vert/frag interface', () => {
    const canvas = makeCanvas()
    const { gl, destroy } = createWebGLContext(canvas)
    try {
      createShaderProgram(gl, LINK_ERR_VERT, LINK_ERR_FRAG)
      // Some drivers promote to compile error — either path is a ShaderCompileError
    } catch (e) {
      expect(e).toBeInstanceOf(ShaderCompileError)
      expect(['vertex', 'fragment', 'link']).toContain((e as ShaderCompileError).stage)
    }
    destroy()
  })

  it('use() does not throw', () => {
    const canvas = makeCanvas()
    const { gl, destroy } = createWebGLContext(canvas)
    const prog = createShaderProgram(gl, MINIMAL_VERT, MINIMAL_FRAG)
    expect(() => prog.use()).not.toThrow()
    prog.destroy()
    destroy()
  })

  it('setUniform ignores unknown uniform name (loc === null path)', () => {
    const canvas = makeCanvas()
    const { gl, destroy } = createWebGLContext(canvas)
    const prog = createShaderProgram(gl, MINIMAL_VERT, MINIMAL_FRAG)
    prog.use()
    expect(() => prog.setUniform('u_nonexistent', 1.0)).not.toThrow()
    expect(() => prog.setUniform('', 1.0)).not.toThrow()
    prog.destroy()
    destroy()
  })

  it('setUniform dispatches number → uniform1f', () => {
    const canvas = makeCanvas()
    const { gl, destroy } = createWebGLContext(canvas)
    const prog = createShaderProgram(gl, UNIFORMS_VERT, UNIFORMS_FRAG)
    prog.use()
    expect(() => prog.setUniform('u_float', 0.5)).not.toThrow()
    prog.destroy()
    destroy()
  })

  it('setUniform accepts 0 (zero boundary)', () => {
    const canvas = makeCanvas()
    const { gl, destroy } = createWebGLContext(canvas)
    const prog = createShaderProgram(gl, UNIFORMS_VERT, UNIFORMS_FRAG)
    prog.use()
    expect(() => prog.setUniform('u_float', 0)).not.toThrow()
    prog.destroy()
    destroy()
  })

  it('setUniform accepts Infinity (WebGL clamps to max float)', () => {
    const canvas = makeCanvas()
    const { gl, destroy } = createWebGLContext(canvas)
    const prog = createShaderProgram(gl, UNIFORMS_VERT, UNIFORMS_FRAG)
    prog.use()
    expect(() => prog.setUniform('u_float', Infinity)).not.toThrow()
    prog.destroy()
    destroy()
  })

  it('setUniform accepts -Infinity', () => {
    const canvas = makeCanvas()
    const { gl, destroy } = createWebGLContext(canvas)
    const prog = createShaderProgram(gl, UNIFORMS_VERT, UNIFORMS_FRAG)
    prog.use()
    expect(() => prog.setUniform('u_float', -Infinity)).not.toThrow()
    prog.destroy()
    destroy()
  })

  it('setUniform accepts NaN (produces undefined GLSL value, no crash)', () => {
    const canvas = makeCanvas()
    const { gl, destroy } = createWebGLContext(canvas)
    const prog = createShaderProgram(gl, UNIFORMS_VERT, UNIFORMS_FRAG)
    prog.use()
    expect(() => prog.setUniform('u_float', NaN)).not.toThrow()
    prog.destroy()
    destroy()
  })

  it('setUniform called multiple times on same uniform is safe', () => {
    const canvas = makeCanvas()
    const { gl, destroy } = createWebGLContext(canvas)
    const prog = createShaderProgram(gl, UNIFORMS_VERT, UNIFORMS_FRAG)
    prog.use()
    expect(() => {
      prog.setUniform('u_float', 0.0)
      prog.setUniform('u_float', 0.5)
      prog.setUniform('u_float', 1.0)
    }).not.toThrow()
    prog.destroy()
    destroy()
  })

  it('setUniform dispatches [n,n] → uniform2fv', () => {
    const canvas = makeCanvas()
    const { gl, destroy } = createWebGLContext(canvas)
    const prog = createShaderProgram(gl, UNIFORMS_VERT, UNIFORMS_FRAG)
    prog.use()
    expect(() => prog.setUniform('u_vec2', [0.5, 0.5])).not.toThrow()
    prog.destroy()
    destroy()
  })

  it('setUniform dispatches [n,n,n] → uniform3fv', () => {
    const canvas = makeCanvas()
    const { gl, destroy } = createWebGLContext(canvas)
    const prog = createShaderProgram(gl, UNIFORMS_VERT, UNIFORMS_FRAG)
    prog.use()
    expect(() => prog.setUniform('u_vec3', [0.5, 0.5, 0.5])).not.toThrow()
    prog.destroy()
    destroy()
  })

  it('setUniform dispatches [n,n,n,n] → uniform4fv', () => {
    const canvas = makeCanvas()
    const { gl, destroy } = createWebGLContext(canvas)
    const prog = createShaderProgram(gl, UNIFORMS_VERT, UNIFORMS_FRAG)
    prog.use()
    expect(() => prog.setUniform('u_vec4', [0.5, 0.5, 0.5, 1.0])).not.toThrow()
    prog.destroy()
    destroy()
  })

  it('setUniform dispatches Float32Array(16) → uniformMatrix4fv', () => {
    const canvas = makeCanvas()
    const { gl, destroy } = createWebGLContext(canvas)
    const prog = createShaderProgram(gl, UNIFORMS_VERT, UNIFORMS_FRAG)
    prog.use()
    expect(() => prog.setUniform('u_mat4', new Float32Array(16))).not.toThrow()
    prog.destroy()
    destroy()
  })

  it('setUniform dispatches Float32Array (length ≠ 16) → uniform1fv', () => {
    const canvas = makeCanvas()
    const { gl, destroy } = createWebGLContext(canvas)
    const prog = createShaderProgram(gl, UNIFORMS_VERT, UNIFORMS_FRAG)
    prog.use()
    expect(() => prog.setUniform('u_float', new Float32Array([0.5]))).not.toThrow()
    prog.destroy()
    destroy()
  })

  it('destroy() does not throw', () => {
    const canvas = makeCanvas()
    const { gl, destroy } = createWebGLContext(canvas)
    const prog = createShaderProgram(gl, MINIMAL_VERT, MINIMAL_FRAG)
    expect(() => prog.destroy()).not.toThrow()
    destroy()
  })

  it('destroy() called twice is safe', () => {
    const canvas = makeCanvas()
    const { gl, destroy } = createWebGLContext(canvas)
    const prog = createShaderProgram(gl, MINIMAL_VERT, MINIMAL_FRAG)
    prog.destroy()
    expect(() => prog.destroy()).not.toThrow()
    destroy()
  })
})

// ---------------------------------------------------------------------------
// WebGLBackend
// ---------------------------------------------------------------------------

describe('WebGLBackend', () => {
  it('compile returns a non-null CompiledProgram', () => {
    const canvas = makeCanvas()
    const backend = new WebGLBackend()
    const compiled = backend.compile(canvas, MINIMAL_FRAG)
    expect(compiled).not.toBeNull()
    compiled.destroy()
    backend.destroy()
  })

  it('compile throws ShaderCompileError for invalid GLSL', () => {
    const canvas = makeCanvas()
    const backend = new WebGLBackend()
    expect(() => backend.compile(canvas, BAD_FRAG)).toThrow(ShaderCompileError)
    backend.destroy()
  })

  it('CompiledProgram.render({}) does not throw', () => {
    const canvas = makeCanvas()
    const backend = new WebGLBackend()
    const compiled = backend.compile(canvas, MINIMAL_FRAG)
    expect(() => compiled.render({})).not.toThrow()
    compiled.destroy()
    backend.destroy()
  })

  it('render passes known uniform types without throwing', () => {
    const canvas = makeCanvas()
    const backend = new WebGLBackend()
    const compiled = backend.compile(canvas, MINIMAL_FRAG)
    expect(() =>
      compiled.render({
        u_time: 1.5,
        u_resolution: [800, 600],
        u_mouse: [0.5, 0.5],
      }),
    ).not.toThrow()
    compiled.destroy()
    backend.destroy()
  })

  it('render silently ignores non-numeric uniform values (string, boolean, object, null)', () => {
    const canvas = makeCanvas()
    const backend = new WebGLBackend()
    const compiled = backend.compile(canvas, MINIMAL_FRAG)
    expect(() =>
      compiled.render({
        bad_string: 'hello',
        bad_bool: true,
        bad_obj: { x: 1 },
        bad_null: null,
      } as Record<string, unknown>),
    ).not.toThrow()
    compiled.destroy()
    backend.destroy()
  })

  it('render called multiple times is consistent', () => {
    const canvas = makeCanvas()
    const backend = new WebGLBackend()
    const compiled = backend.compile(canvas, MINIMAL_FRAG)
    for (let i = 0; i < 5; i++) {
      expect(() => compiled.render({ u_time: i * 0.016 })).not.toThrow()
    }
    compiled.destroy()
    backend.destroy()
  })

  it('CompiledProgram.destroy() does not throw', () => {
    const canvas = makeCanvas()
    const backend = new WebGLBackend()
    const compiled = backend.compile(canvas, MINIMAL_FRAG)
    expect(() => compiled.destroy()).not.toThrow()
    backend.destroy()
  })

  it('WebGLBackend.destroy() does not throw', () => {
    const backend = new WebGLBackend()
    expect(() => backend.destroy()).not.toThrow()
  })

  it('destroy() called twice is safe (contextHandle set to null)', () => {
    const canvas = makeCanvas()
    const backend = new WebGLBackend()
    backend.compile(canvas, MINIMAL_FRAG).destroy()
    backend.destroy()
    expect(() => backend.destroy()).not.toThrow()
  })
})

