# Phase 3 Tech Spec: `@funny-colors/renderer`

## Prerequisites

Phase 2 complete. `@funny-colors/core` builds cleanly and its types are available.

Read before starting:
- `packages/renderer/CONTEXT.md`
- `packages/renderer/src/backend.ts` — `RendererBackend` and `CompiledProgram` interfaces (already defined)
- `docs/adr/ADR-003-graphics-api.md`

---

## Goal

Implement the WebGL renderer backend and the GLSL math utility library. This is the only package that touches WebGL APIs or `HTMLCanvasElement`. All WebGL code stays inside `src/webgl/`.

---

## Files to create

```
packages/renderer/src/
  backend.ts          (exists — do not modify the interfaces)
  index.ts            (exists — update exports)
  webgl/
    index.ts          WebGL implementation of RendererBackend
    program.ts        Shader compilation, linking, uniform binding
    context.ts        WebGL context creation and management
    webgl.test.ts     Browser-mode tests
  math/
    index.ts          Re-exports all math utilities
    noise.ts          FBM, Simplex, Worley noise GLSL source strings
    color.ts          Color space conversion GLSL utilities (hsv↔rgb, etc.)
    math.ts           Common GLSL math helpers (remap, smoothstep wrappers, etc.)
    noise.test.ts
    color.test.ts
    math.test.ts
packages/renderer/
  vitest.config.ts
  vitest.browser.config.ts
```

---

## 1. `src/math/` — GLSL Utility Library

These are **TypeScript modules that export GLSL source code strings**. They are consumed by the shader compiler when building the final program.

### `src/math/noise.ts`

```ts
/** GLSL implementation of fractional Brownian motion noise. */
export const FBM_GLSL: string

/** GLSL implementation of Simplex noise. */
export const SIMPLEX_GLSL: string

/** GLSL implementation of Worley (cellular) noise. */
export const WORLEY_GLSL: string
```

Each constant is a multi-line GLSL string containing the function definitions. They are concatenated into the shader preamble during compilation.

### `src/math/color.ts`

```ts
export const HSV_TO_RGB_GLSL: string   // vec3 hsv2rgb(vec3 c)
export const RGB_TO_HSV_GLSL: string   // vec3 rgb2hsv(vec3 c)
export const LINEAR_TO_SRGB_GLSL: string
export const SRGB_TO_LINEAR_GLSL: string
```

### `src/math/math.ts`

```ts
export const REMAP_GLSL: string        // float remap(float v, float inMin, float inMax, float outMin, float outMax)
export const SMOOTHSTEP_GLSL: string   // already in GLSL but wrapped with a cleaner API
export const ROTATE2D_GLSL: string     // mat2 rotate2d(float angle)
```

### Testing math utilities

Math tests run in Node (no browser needed) — they validate that:
- Each exported string is a non-empty string
- Each string contains the expected GLSL function signature
- GLSL strings compile without error when tested via a WebGL shader compilation call (this test runs in browser mode)

---

## 2. `src/webgl/context.ts` — WebGL Context Management

```ts
export interface WebGLContextHandle {
  gl: WebGL2RenderingContext
  destroy(): void
}

/**
 * Creates a WebGL2 context on the given canvas.
 * Throws if WebGL2 is not supported.
 */
export function createWebGLContext(canvas: HTMLCanvasElement): WebGLContextHandle
```

- Always request WebGL2 (`canvas.getContext('webgl2')`)
- Throw a descriptive `WebGLNotSupportedError` if `null` is returned
- `destroy()` calls `gl.getExtension('WEBGL_lose_context')?.loseContext()`

```ts
export class WebGLNotSupportedError extends Error {
  constructor() { super('WebGL2 is not supported in this environment') }
}
```

---

## 3. `src/webgl/program.ts` — Shader Compilation

```ts
export interface ShaderProgram {
  use(): void
  setUniform(name: string, value: UniformValue): void
  destroy(): void
}

export type UniformValue =
  | number
  | [number, number]
  | [number, number, number]
  | [number, number, number, number]
  | Float32Array

/**
 * Compiles and links a vertex + fragment shader pair.
 * Throws ShaderCompileError with the full info log on failure.
 */
export function createShaderProgram(
  gl: WebGL2RenderingContext,
  vertSrc: string,
  fragSrc: string,
): ShaderProgram

export class ShaderCompileError extends Error {
  constructor(public readonly stage: 'vertex' | 'fragment' | 'link', message: string) {
    super(`Shader ${stage} error: ${message}`)
  }
}
```

**`setUniform` dispatch:**
- `number` → `uniform1f`
- `[n, n]` → `uniform2fv`
- `[n, n, n]` → `uniform3fv`
- `[n, n, n, n]` → `uniform4fv`
- `Float32Array` → `uniformMatrix4fv` (if length 16) or `uniform1fv`

---

## 4. `src/webgl/index.ts` — WebGL RendererBackend Implementation

```ts
import type { RendererBackend, CompiledProgram } from '../backend.js'

export class WebGLBackend implements RendererBackend {
  compile(canvas: HTMLCanvasElement, fragSrc: string): CompiledProgram
  destroy(): void
}
```

**Standard vertex shader** (fullscreen quad, no geometry needed):
```glsl
#version 300 es
out vec2 vUv;
void main() {
  vec2 pos = vec2((gl_VertexID & 1) * 2 - 1, (gl_VertexID >> 1) * 2 - 1);
  vUv = pos * 0.5 + 0.5;
  gl_Position = vec4(pos, 0.0, 1.0);
}
```

The fragment shader receives the compiled GLSL from the DAG Output node. Standard uniforms injected automatically:
- `uniform float u_time` — elapsed seconds
- `uniform vec2 u_resolution` — canvas width/height in pixels
- `uniform vec2 u_mouse` — normalised mouse position [0,1]

`CompiledProgram.render(uniforms)` binds the program, sets uniforms, draws a fullscreen triangle (`gl.drawArrays(gl.TRIANGLES, 0, 3)`), and calls `gl.flush()`.

---

## 5. Update `src/index.ts`

```ts
export * from './backend.js'
export * from './webgl/index.js'
export * from './math/index.js'
export { WebGLNotSupportedError } from './webgl/context.js'
export { ShaderCompileError } from './webgl/program.js'
```

---

## 6. Vitest configuration

### `vitest.config.ts` (Node — math string tests only)

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/math/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/math/**'],
      thresholds: { lines: 95, functions: 95, branches: 90, statements: 95 },
    },
  },
})
```

### `vitest.browser.config.ts` (Browser — WebGL tests)

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      name: 'chromium',
      provider: 'playwright',
    },
    include: ['src/webgl/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/webgl/**'],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
})
```

Update `packages/renderer/package.json` scripts:
```json
"test": "vitest run --config vitest.config.ts --coverage",
"test:browser": "vitest run --config vitest.browser.config.ts --coverage"
```

---

## 7. Tests

### `src/math/*.test.ts` (Node)

For each math module:
- Exported strings are non-empty
- Strings contain the expected function signature (e.g. `fbm(` for `FBM_GLSL`)
- No syntax errors detectable via regex on common GLSL patterns

### `src/webgl/webgl.test.ts` (Browser — needs real WebGL)

- `createWebGLContext` returns a handle with a valid `WebGL2RenderingContext`
- `createWebGLContext` throws `WebGLNotSupportedError` when given a detached canvas
- `createShaderProgram` compiles a minimal valid vert + frag shader without throwing
- `createShaderProgram` throws `ShaderCompileError` with correct `.stage` for invalid GLSL
- `WebGLBackend.compile` returns a `CompiledProgram` that calls `render()` without throwing
- `CompiledProgram.destroy()` does not throw
- `WebGLBackend.destroy()` does not throw

---

## Definition of done

- [ ] `pnpm --filter @funny-colors/renderer build` succeeds
- [ ] `pnpm --filter @funny-colors/renderer test` passes (math, Node)
- [ ] `pnpm --filter @funny-colors/renderer test:browser` passes (WebGL, Chromium)
- [ ] No TypeScript errors
- [ ] `WebGLBackend`, `ShaderCompileError`, `WebGLNotSupportedError`, all math constants exported from package root
- [ ] No WebGL types imported outside of `src/webgl/`
