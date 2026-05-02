// RendererBackend interface — the IR abstraction between the DAG compiler
// and the graphics API. WebGL implements this today; WebGPU will later.

export interface RendererBackend {
  /** Compile a DAG into runnable GPU code and attach it to the canvas. */
  compile(canvas: HTMLCanvasElement, source: string): CompiledProgram
  destroy(): void
}

/** Opaque handle to a compiled GPU program. */
export interface CompiledProgram {
  render(uniforms: Record<string, unknown>): void
  destroy(): void
}
