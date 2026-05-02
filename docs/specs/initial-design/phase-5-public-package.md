# Phase 5 Tech Spec: `funny-colors` (Public Package)

## Prerequisites

Phases 2, 3, and 4 complete. All internal packages build cleanly.

Read before starting:
- `packages/funny-colors/CONTEXT.md`
- `packages/core/src/types.ts` — `GraphConfig`, `BackgroundInstance`, `ExecutionContext`
- `docs/adr/ADR-007-export-format.md`
- `docs/adr/ADR-009-runtime-params.md`

---

## Goal

Implement `createBackground()`, wire the DAG engine to the WebGL renderer, and ship the CLI stub. This is the package end users install.

---

## Files to create / modify

```
packages/funny-colors/src/
  index.ts      (exists — update exports)
  runtime.ts    (implement createBackground)
  cli.ts        (implement basic CLI)
  runtime.test.ts
  cli.test.ts
packages/funny-colors/
  vitest.config.ts
```

---

## 1. `src/runtime.ts` — `createBackground()`

### Signature (already declared in types.ts)

```ts
import type { BackgroundInstance, GraphConfig } from '@funny-colors/core'

export function createBackground(
  canvas: HTMLCanvasElement,
  config: GraphConfig,
): BackgroundInstance
```

### Implementation

`createBackground` wires together all three internal packages:

```
GraphConfig
  → buildEvaluationOrder (core/dag)
  → createDagRunner (core/dag)
  → createParamStore (core/param-store)
  → WebGLBackend.compile (renderer/webgl)
  → requestAnimationFrame loop
```

**Step-by-step:**

1. Validate `config.version === 1` — throw `UnsupportedConfigVersionError` otherwise
2. Build a `NodeRegistry` from all nodes exported by `@funny-colors/nodes` (import them all and register by `id`)
3. Create a `ParamStore` from `config.params`
4. Create a `DagRunner` from `config` and the registry
5. Create a `WebGLBackend` and compile the shader:
   - Walk the graph to the `CanvasOutputNode`
   - Collect the GLSL math preamble from `@funny-colors/renderer/math`
   - Generate the fragment shader `main()` body by traversing the DAG output connections
   - Call `backend.compile(canvas, fullFragSrc)`
6. Register a `ParamStore.onChange` listener that calls `runner.markDirty(paramNodeInstanceId)`
7. Start the animation loop:

```ts
let rafId: number
let lastTime = 0

function frame(timestamp: number) {
  const ctx: ExecutionContext = {
    time: timestamp / 1000,
    mouse: currentMouse,      // updated by mousemove listener on canvas
    audio: currentAudioData,  // updated by audio analyser if AudioNode present
    canvas: { width: canvas.width, height: canvas.height },
    params: paramStore snapshot,
  }
  runner.evaluate(ctx)
  compiledProgram.render({
    u_time: ctx.time,
    u_resolution: [canvas.width, canvas.height],
    u_mouse: ctx.mouse,
    // additional uniforms from DAG output node
  })
  rafId = requestAnimationFrame(frame)
}

rafId = requestAnimationFrame(frame)
```

8. Return `BackgroundInstance`:

```ts
return {
  setParam(name, value) {
    paramStore.set(name, value)
  },
  destroy() {
    cancelAnimationFrame(rafId)
    canvas.removeEventListener('mousemove', onMouseMove)
    runner.destroy()
    compiledProgram.destroy()
    backend.destroy()
  },
}
```

### Mouse tracking

Attach a `mousemove` listener to the canvas on creation:

```ts
function onMouseMove(e: MouseEvent) {
  const rect = canvas.getBoundingClientRect()
  currentMouse = [
    (e.clientX - rect.left) / rect.width,
    1 - (e.clientY - rect.top) / rect.height,  // flip Y so 0,0 is bottom-left
  ]
}
canvas.addEventListener('mousemove', onMouseMove)
```

### Errors

```ts
export class UnsupportedConfigVersionError extends Error {
  constructor(version: number) {
    super(`Unsupported GraphConfig version: ${version}. Expected 1.`)
  }
}
```

---

## 2. `src/cli.ts` — CLI

Implement a minimal but functional CLI:

```
Usage: funny-colors build <graph.json> [--out <file.js>] [--target webgl|webgpu]
```

**Steps:**
1. Parse `process.argv` (no CLI framework — plain argument parsing)
2. Read and parse the JSON file
3. Validate it is a `GraphConfig` (check `version` field)
4. Use `esbuild` to bundle a self-contained output:
   - Entry: a generated temp file that calls `createBackground(document.querySelector('canvas'), config)`
   - Bundle all `@funny-colors/*` deps inline
   - Output: single JS file (default: `<input-basename>.bundle.js`)
5. Print success message with output file path

```ts
#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { build } from 'esbuild'
```

Add `esbuild` as a dependency in `packages/funny-colors/package.json`.

---

## 3. `src/index.ts` — Re-exports

```ts
export type * from '@funny-colors/core'
export * from '@funny-colors/nodes'
export * from '@funny-colors/renderer'

export { createBackground, UnsupportedConfigVersionError } from './runtime.js'
```

Do NOT export the CLI from the main entry — it is ESM-only and uses Node.js APIs.

---

## 4. Tests

### `src/runtime.test.ts`

These tests run in a browser (need canvas + WebGL). Use Vitest browser mode.

- `createBackground` throws `UnsupportedConfigVersionError` for version !== 1
- `createBackground` returns a `BackgroundInstance` with `setParam` and `destroy`
- `setParam` updates the param store without throwing
- `destroy` cancels the animation frame (spy on `cancelAnimationFrame`)
- `destroy` does not throw when called twice

Create a minimal valid `GraphConfig` fixture:

```ts
const minimalConfig: GraphConfig = {
  version: 1,
  nodes: [
    { instanceId: 'time-1', definitionId: 'source/time', position: { x: 0, y: 0 } },
    { instanceId: 'output-1', definitionId: 'output/canvas', position: { x: 300, y: 0 } },
  ],
  edges: [
    { fromInstanceId: 'time-1', fromPort: 'time', toInstanceId: 'output-1', toPort: 'color' },
  ],
  params: {},
}
```

### `src/cli.test.ts`

Node environment only.

- Prints usage when called with no arguments
- Throws / exits with error for a non-existent file
- Reads and validates a valid JSON config
- (Integration) bundles a minimal config to a JS file (can use a temp dir)

---

## 5. `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      name: 'chromium',
      provider: 'playwright',
    },
    coverage: {
      provider: 'v8',
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
})
```

---

## Usage documentation (write this file too)

Create `docs/usage/getting-started.md` (see Phase 5 deliverables).

---

## Definition of done

- [ ] `pnpm --filter funny-colors build` succeeds — generates `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts`, `dist/cli.js`
- [ ] `pnpm --filter funny-colors test` passes
- [ ] No TypeScript errors
- [ ] `createBackground` and `UnsupportedConfigVersionError` exported from package root
- [ ] `npx funny-colors build` prints usage without crashing
- [ ] Tree-shaking verified: install package in a blank Vite project, import only `NoiseNode`, confirm bundle contains only `NoiseNode` (check with `vite build --reporter json`)
- [ ] `docs/usage/getting-started.md` written
