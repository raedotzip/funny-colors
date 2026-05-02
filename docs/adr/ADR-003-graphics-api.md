# ADR-003: Graphics API — IR Abstraction with WebGL First

**Status:** Accepted  
**Date:** 2026-05-01

## Context

We needed to choose between WebGL (GLSL), WebGPU (WGSL), or an abstraction layer covering both.

- WebGL: ~98% browser support, mature ecosystem, no compute shaders
- WebGPU: modern API, compute shaders, ~85% support today (no Firefox stable, limited older Safari)

## Decision

Build an internal IR (intermediate representation) abstraction layer. Ship WebGL as the initial backend. Add a WebGPU backend once browser support matures.

The `RendererBackend` interface in `@funny-colors/renderer` is the abstraction point:

```ts
interface RendererBackend {
  compile(canvas: HTMLCanvasElement, source: string): CompiledProgram
  destroy(): void
}
```

## Rationale

- Broadest reach on day one (WebGL)
- Future-proof: swapping to WebGPU requires only a new `RendererBackend` implementation — core and nodes are unaffected
- Plugin authors write against node port types, not shader APIs — they are fully insulated from the backend choice

## Consequences

- All WebGL-specific code must stay inside `packages/renderer/src/webgl/` — nothing else may import WebGL types directly
- The shader compilation pipeline must be designed against the IR, not raw GLSL, so it can target both backends
- `lib/compute/` is reserved for future Rust/WASM compute work
