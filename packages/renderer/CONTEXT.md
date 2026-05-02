# @funny-colors/renderer — Package Context

## Responsibility

The graphics backend abstraction layer and WebGL implementation. This package:
- Defines the `RendererBackend` interface — the IR abstraction between the DAG compiler and the GPU
- Implements the WebGL backend (GLSL shaders, canvas setup, uniform binding)
- Contains math utility functions used to generate shader code from node outputs
- Is the only package that touches the DOM (`HTMLCanvasElement`) or WebGL APIs

## What it does NOT do

- Does not run the DAG or know about the node graph — it receives compiled shader source
- Does not contain node logic — that lives in `@funny-colors/nodes`
- The WebGPU backend does not exist yet — it will be added here behind the same `RendererBackend` interface

## Key files

| File | Purpose |
|---|---|
| `src/backend.ts` | `RendererBackend` interface + `CompiledProgram` interface |
| `src/webgl/index.ts` | WebGL implementation of `RendererBackend` (Phase 3) |
| `src/math/` | GLSL math utilities (noise functions, color space conversions, etc.) |

## Graphics API strategy

Current backend: **WebGL (GLSL)**
Future backend: **WebGPU (WGSL)** — added once browser support matures (~85% today)

Swapping backends requires only a new `RendererBackend` implementation. Core, nodes, and the public package are unaffected. The user selects the target backend at export time.

## RendererBackend interface

```ts
interface RendererBackend {
  compile(canvas: HTMLCanvasElement, source: string): CompiledProgram
  destroy(): void
}
```

All WebGL-specific code is contained within `src/webgl/`. Nothing outside this package depends on WebGL types directly.

## Testing

Renderer tests run in a real browser context via Vitest browser mode + Playwright.
This is required because WebGL is not available in Node.js.
Target: near 100% coverage including shader compilation and uniform binding.
