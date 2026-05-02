import { createWebGLContext } from '../webgl/context.js'
import { createShaderProgram } from '../webgl/program.js'

const EVAL_VERT = `#version 300 es
void main() {
  vec2 pos = vec2(
    float(gl_VertexID & 1) * 4.0 - 1.0,
    float((gl_VertexID >> 1) & 1) * 4.0 - 1.0
  );
  gl_Position = vec4(pos, 0.0, 1.0);
}`

export function compileWithPreamble(preamble: string): void {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const { gl, destroy } = createWebGLContext(canvas)
  const fragSrc = `#version 300 es
precision highp float;
${preamble}
out vec4 fragColor;
void main() { fragColor = vec4(0.0); }`
  const prog = createShaderProgram(gl, EVAL_VERT, fragSrc)
  prog.destroy()
  destroy()
}

export function evalGlsl(preamble: string, body: string): [number, number, number, number] {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const gl = canvas.getContext('webgl2')!
  const fragSrc = `#version 300 es
precision highp float;
${preamble}
out vec4 fragColor;
void main() { ${body} }`
  const prog = createShaderProgram(gl, EVAL_VERT, fragSrc)
  prog.use()
  gl.viewport(0, 0, 1, 1)
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
  gl.flush()
  const pixel = new Uint8Array(4)
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
  prog.destroy()
  gl.getExtension('WEBGL_lose_context')?.loseContext()
  return [pixel[0]! / 255, pixel[1]! / 255, pixel[2]! / 255, pixel[3]! / 255]
}
