/**
 * @fileoverview Public entry point for `@funny-colors/renderer`.
 *
 * Re-exports all public surfaces of the package:
 *
 * - **Backend interfaces** — {@link RendererBackend}, {@link CompiledProgram}
 * - **WebGL backend** — {@link WebGLBackend}
 * - **Error classes** — {@link WebGLNotSupportedError}, {@link ShaderCompileError}
 * - **GLSL math constants** — all noise, color, and math helper strings
 *
 * @see {@link RendererBackend}
 * @see {@link WebGLBackend}
 * @see {@link WebGLNotSupportedError}
 * @see {@link ShaderCompileError}
 *
 * @module
 */

export * from './backend.js'
export * from './webgl/index.js'
export * from './math/index.js'
export { WebGLNotSupportedError } from './webgl/context.js'
export { ShaderCompileError } from './webgl/program.js'
