# Phase 4 Tech Spec: `@funny-colors/nodes`

## Prerequisites

Phases 2 and 3 complete. Both `@funny-colors/core` and `@funny-colors/renderer` build cleanly.

Read before starting:
- `packages/nodes/CONTEXT.md`
- `packages/core/src/types.ts` — all node interfaces
- `docs/adr/ADR-004-plugin-shape.md`
- `docs/adr/ADR-005-node-taxonomy.md`
- `docs/contributing/writing-a-plugin.md` (written in this phase — see below)

---

## Goal

Implement all built-in node types as named ESM exports. Every node is a pure `NodeDefinition` object — no classes, no side effects. Each node file is independently testable with just Vitest and no browser.

---

## File structure

```
packages/nodes/src/
  index.ts                    (update with all named exports)
  source/
    mouse.ts + mouse.test.ts
    audio.ts + audio.test.ts
    time.ts  + time.test.ts
    param.ts + param.test.ts
  transform/
    noise.ts  + noise.test.ts
    math.ts   + math.test.ts
    color-map.ts + color-map.test.ts
    remap.ts  + remap.test.ts
    vector.ts + vector.test.ts
  buffer/
    feedback.ts + feedback.test.ts
  sampler/
    gradient.ts + gradient.test.ts
  logic/
    threshold.ts + threshold.test.ts
    switch.ts    + switch.test.ts
  output/
    canvas-output.ts + canvas-output.test.ts
packages/nodes/
  vitest.config.ts
```

---

## Node implementation contract

Every node file exports a single `const` that is a `NodeDefinition`. Example structure:

```ts
import type { TransformNodeDefinition } from '@funny-colors/core'

export const RemapNode: TransformNodeDefinition = {
  id: 'transform/remap',
  type: 'transform',
  label: 'Remap',
  inputs: [
    { name: 'value',  type: 'float' },
    { name: 'inMin',  type: 'float', default: 0 },
    { name: 'inMax',  type: 'float', default: 1 },
    { name: 'outMin', type: 'float', default: 0 },
    { name: 'outMax', type: 'float', default: 1 },
  ],
  outputs: [
    { name: 'result', type: 'float' },
  ],
  evaluate({ value, inMin, inMax, outMin, outMax }) {
    const t = ((value as number) - (inMin as number)) / ((inMax as number) - (inMin as number))
    return { result: (outMin as number) + t * ((outMax as number) - (outMin as number)) }
  },
}
```

---

## Node specifications

### Source nodes

#### `MouseNode` (`source/mouse.ts`)
- id: `'source/mouse'`
- outputs: `[{ name: 'position', type: 'vec2' }]`
- evaluate: returns `{ position: ctx.mouse }`

#### `AudioNode` (`source/audio.ts`)
- id: `'source/audio'`
- outputs: `[{ name: 'bass', type: 'float' }, { name: 'mid', type: 'float' }, { name: 'treble', type: 'float' }, { name: 'raw', type: 'vec4' }]`
- evaluate: if `ctx.audio` is null, return zeros. Otherwise average frequency bands:
  - bass: average of bins 0–10% of array length
  - mid: average of bins 10–50%
  - treble: average of bins 50–100%
  - raw: `[bass, mid, treble, overall_average]`

#### `TimeNode` (`source/time.ts`)
- id: `'source/time'`
- outputs: `[{ name: 'time', type: 'float' }, { name: 'delta', type: 'float' }, { name: 'cycle', type: 'float' }]`
- evaluate: `{ time: ctx.time, delta: 0, cycle: (ctx.time % 1.0) }`
  - Note: `delta` (frame delta time) requires Buffer state — defer to Phase 4b or implement as Buffer node if needed

#### `ParamNode` (`source/param.ts`)
- id: `'source/param'`
- Special: this node is configured with a `paramName` at graph instantiation time
- outputs: `[{ name: 'value', type: 'float' }]`
- evaluate: returns `{ value: ctx.params[paramName] ?? 0 }`
- The `paramName` is encoded in the `GraphNode` instance config (extend `GraphNode` with an optional `config` field if needed)

---

### Transform nodes

#### `NoiseNode` (`transform/noise.ts`)
- id: `'transform/noise'`
- inputs: `position: vec2`, `scale: float (default: 1)`, `octaves: int (default: 4)`, `seed: float (default: 0)`
- outputs: `value: float`
- evaluate: implement fBm noise in TypeScript (same algorithm as the GLSL version in `@funny-colors/renderer/math/noise.ts`)
  - This is the JS evaluation for the DAG; the GLSL version is for the final shader

#### `MathNode` (`transform/math.ts`)
- id: `'transform/math'`
- inputs: `a: float`, `b: float (default: 0)`, `operation: int (default: 0)`
- outputs: `result: float`
- Operations (encoded as integer):
  - 0: add, 1: subtract, 2: multiply, 3: divide, 4: pow, 5: min, 6: max, 7: abs(a), 8: floor(a), 9: ceil(a), 10: fract(a), 11: sqrt(a)
- evaluate: dispatch on `operation`

#### `ColorMapNode` (`transform/color-map.ts`)
- id: `'transform/color-map'`
- inputs: `value: float`, `stops: vec4[]` (array of `[position, r, g, b]` tuples)
- outputs: `color: vec3`
- evaluate: linear interpolation between the two nearest color stops

#### `RemapNode` (`transform/remap.ts`)
- See example above

#### `VectorNode` (`transform/vector.ts`)
- id: `'transform/vector'`
- inputs: `x: float`, `y: float (default: 0)`, `z: float (default: 0)`, `w: float (default: 0)`, `components: int (default: 2)`
- outputs: `vec2: vec2`, `vec3: vec3`, `vec4: vec4`
- evaluate: construct vectors from components

---

### Buffer nodes

#### `FeedbackNode` (`buffer/feedback.ts`)
- id: `'buffer/feedback'`
- inputs: `input: vec4`, `mix: float (default: 0.9)`
- outputs: `output: vec4`
- `initState()` returns `{ value: [0, 0, 0, 0] }`
- evaluate: `output = lerp(state.value, input, 1 - mix)`, update state with new output

---

### Sampler nodes

#### `GradientSamplerNode` (`sampler/gradient.ts`)
- id: `'sampler/gradient'`
- inputs: `t: float`
- outputs: `color: vec3`
- Built-in gradient stops (configurable via node config): default is a rainbow gradient
- evaluate: sample the gradient at `t` via linear interpolation

---

### Logic nodes

#### `ThresholdNode` (`logic/threshold.ts`)
- id: `'logic/threshold'`
- inputs: `value: float`, `threshold: float (default: 0.5)`, `ifAbove: float (default: 1)`, `ifBelow: float (default: 0)`
- outputs: `result: float`
- evaluate: `value > threshold ? ifAbove : ifBelow`

#### `SwitchNode` (`logic/switch.ts`)
- id: `'logic/switch'`
- inputs: `condition: boolean`, `ifTrue: float`, `ifFalse: float`
- outputs: `result: float`
- evaluate: `condition ? ifTrue : ifFalse`

---

### Output nodes

#### `CanvasOutputNode` (`output/canvas-output.ts`)
- id: `'output/canvas'`
- inputs: `color: vec3`, `position: vec2`
- outputs: `[]`
- evaluate: this node does not do JS computation — it is a marker that signals the shader compiler to produce the final fragment color
- Returns `{}`
- The DAG compiler reads this node's input connections to generate the final GLSL `main()` function

---

## `src/index.ts` — named exports

Every node must be a named export so bundlers can tree-shake:

```ts
export { MouseNode } from './source/mouse.js'
export { AudioNode } from './source/audio.js'
export { TimeNode } from './source/time.js'
export { ParamNode } from './source/param.js'
export { NoiseNode } from './transform/noise.js'
export { MathNode } from './transform/math.js'
export { ColorMapNode } from './transform/color-map.js'
export { RemapNode } from './transform/remap.js'
export { VectorNode } from './transform/vector.js'
export { FeedbackNode } from './buffer/feedback.js'
export { GradientSamplerNode } from './sampler/gradient.js'
export { ThresholdNode } from './logic/threshold.js'
export { SwitchNode } from './logic/switch.js'
export { CanvasOutputNode } from './output/canvas-output.js'
```

---

## Testing

Every node test file follows this pattern:

```ts
import { describe, it, expect } from 'vitest'
import { RemapNode } from './remap.js'

describe('RemapNode', () => {
  it('remaps value from input range to output range', () => {
    const result = RemapNode.evaluate({ value: 0.5, inMin: 0, inMax: 1, outMin: 0, outMax: 100 }, mockCtx)
    expect(result.result).toBe(50)
  })

  it('uses default values when inputs are missing', () => {
    const result = RemapNode.evaluate({ value: 0.5 }, mockCtx)
    expect(result.result).toBeCloseTo(0.5)
  })
})
```

`mockCtx` is a test helper:

```ts
// src/test-utils.ts
import type { ExecutionContext } from '@funny-colors/core'

export const mockCtx: ExecutionContext = {
  time: 0,
  mouse: [0.5, 0.5],
  audio: null,
  canvas: { width: 800, height: 600 },
  params: {},
}
```

---

## Contributing guide (write this file too)

Create `docs/contributing/writing-a-plugin.md` — see Phase 4 deliverables below.

---

## `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      thresholds: { lines: 95, functions: 95, branches: 90, statements: 95 },
    },
  },
})
```

---

## Definition of done

- [ ] `pnpm --filter @funny-colors/nodes build` succeeds
- [ ] `pnpm --filter @funny-colors/nodes test` passes with ≥95% line coverage
- [ ] No TypeScript errors
- [ ] All 14 nodes are named exports from `src/index.ts`
- [ ] Each node's `id` is unique across the registry (no duplicates)
- [ ] `docs/contributing/writing-a-plugin.md` written
- [ ] `src/test-utils.ts` exported for use in downstream packages
