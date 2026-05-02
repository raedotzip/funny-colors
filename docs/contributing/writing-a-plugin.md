# Writing a Plugin (Custom Node Type)

A plugin is an npm package that exports one or more `NodeDefinition` objects. Once registered, the definitions appear in the builder's node palette and are available at runtime.

## Quick start

```bash
mkdir my-funny-colors-plugin
cd my-funny-colors-plugin
pnpm init
pnpm add -D @funny-colors/core typescript
```

## 1. Choose a node type

Pick the taxonomy type that matches your node's role (see `docs/adr/ADR-005-node-taxonomy.md`):

| If your node... | Use type |
|---|---|
| Reads from mouse, audio, time, or user input | `source` |
| Takes upstream values and computes a new value | `transform` |
| Needs to remember something across frames | `buffer` |
| Samples a gradient, texture, or lookup table | `sampler` |
| Routes values conditionally | `logic` |
| Wraps a reusable subgraph | `group` |
| Is the final rendering output | `output` |

## 2. Define your node

```ts
// src/index.ts
import type { TransformNodeDefinition } from '@funny-colors/core'

export const WobbleNode: TransformNodeDefinition = {
  id: 'my-plugin/wobble',        // must be globally unique — use your npm package name as prefix
  type: 'transform',
  label: 'Wobble',
  inputs: [
    { name: 'position', type: 'vec2' },
    { name: 'frequency', type: 'float', default: 2.0 },
    { name: 'amplitude', type: 'float', default: 0.1 },
    { name: 'time', type: 'float', default: 0 },
  ],
  outputs: [
    { name: 'position', type: 'vec2' },
  ],
  evaluate({ position, frequency, amplitude, time }) {
    const [x, y] = position as [number, number]
    const offset = Math.sin((x * (frequency as number)) + (time as number)) * (amplitude as number)
    return { position: [x, y + offset] }
  },
}
```

## 3. Rules

**All nodes:**
- `id` must be unique. Use `your-package-name/node-name` format to avoid collisions.
- `evaluate` must be a pure function — no global state, no side effects, no async.
- Input/output `type` must be one of: `float`, `vec2`, `vec3`, `vec4`, `color`, `boolean`, `int`.
- All input `default` values must match the declared `type`.

**Source nodes:**
- `inputs` must be an empty array `[]`.
- Read live data from the `ctx` parameter (second argument to `evaluate`).

**Buffer nodes:**
- Must implement `initState(): FrameState`.
- `evaluate` receives the current frame state via `ctx.__frameState` (internal convention).
- Return updated state under `__nextFrameState` in the output map.

**Output nodes:**
- `outputs` must be an empty array `[]`.
- `evaluate` should return `{}`.

## 4. Port types reference

| Type | JS value | GLSL type |
|---|---|---|
| `float` | `number` | `float` |
| `int` | `number` (integer) | `int` |
| `boolean` | `boolean` | `bool` |
| `vec2` | `[number, number]` | `vec2` |
| `vec3` | `[number, number, number]` | `vec3` |
| `vec4` | `[number, number, number, number]` | `vec4` |
| `color` | `[number, number, number]` (0–1 linear) | `vec3` |

## 5. Test your node

```ts
// src/index.test.ts
import { describe, it, expect } from 'vitest'
import { WobbleNode } from './index.js'

const mockCtx = {
  time: 0, mouse: [0.5, 0.5], audio: null,
  canvas: { width: 800, height: 600 }, params: {},
}

describe('WobbleNode', () => {
  it('returns a vec2 position', () => {
    const result = WobbleNode.evaluate(
      { position: [0.5, 0.5], frequency: 2, amplitude: 0.1, time: 0 },
      mockCtx,
    )
    expect(result.position).toHaveLength(2)
  })
})
```

## 6. Publish

```json
// package.json
{
  "name": "funny-colors-plugin-wobble",
  "exports": {
    ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" }
  },
  "peerDependencies": {
    "@funny-colors/core": ">=0.1.0"
  }
}
```

## 7. Register at runtime

```ts
import { createBackground } from 'funny-colors'
import { WobbleNode } from 'funny-colors-plugin-wobble'
import myGraph from './my-graph.json'

// Future API — plugin registry not yet implemented in Phase 5.
// For now, custom nodes must be registered via the NodeRegistry mechanism in @funny-colors/core.
const bg = createBackground(canvas, myGraph, {
  plugins: [WobbleNode],
})
```

> Note: the `plugins` option to `createBackground` is planned for Phase 5. See the Phase 5 spec for the final API.
