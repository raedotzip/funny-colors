# funny-colors — Library Technical Reference

**Package:** `funny-colors`  
**Version:** 0.1  
**Target:** Developers embedding procedural backgrounds in web projects.

---

## Overview

`funny-colors` is a tree-shakeable TypeScript library for embedding procedurally generated, animated backgrounds on any web page. Users compose visual effects by connecting nodes in a graph (using the visual builder or writing JSON directly), then pass the resulting `GraphConfig` to `createBackground()`. The library evaluates the graph each frame and renders the result to a WebGL canvas.

The library has **no framework dependency**. It works in any environment that provides a canvas element and WebGL2.

---

## Installation

```bash
npm install funny-colors
# or
pnpm add funny-colors
# or
yarn add funny-colors
```

**Requirements:**
- Browser with WebGL2 support (Chrome 56+, Firefox 51+, Safari 15+)
- A bundler that supports ES modules (Vite, webpack 5+, esbuild, Rollup)
- No Node.js runtime required — the library is browser-only

---

## Quick Start

```ts
import { createBackground } from 'funny-colors'

const canvas = document.getElementById('bg') as HTMLCanvasElement
const bg = createBackground(canvas, {
  version: 1,
  nodes: [
    { instanceId: 'time', definitionId: 'source/time', position: { x: 0, y: 0 } },
    { instanceId: 'noise', definitionId: 'transform/noise', position: { x: 200, y: 0 } },
    { instanceId: 'out', definitionId: 'output/canvas', position: { x: 400, y: 0 } },
  ],
  edges: [
    { fromInstanceId: 'time', fromPort: 'time', toInstanceId: 'noise', toPort: 'time' },
    { fromInstanceId: 'noise', fromPort: 'value', toInstanceId: 'out', toPort: 'color' },
  ],
  params: {},
})

// Later:
bg.destroy()
```

---

## API Reference

### `createBackground(canvas, config, options?)`

Creates and starts a procedural background on the given canvas.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `canvas` | `HTMLCanvasElement` | The canvas to render onto |
| `config` | `GraphConfig` | The node graph to evaluate (see Graph Config) |
| `options.plugins` | `NodeDefinition[]` | Additional custom node types to register |

**Returns:** `BackgroundInstance`

**Throws:**

| Error | Condition |
|---|---|
| `UnsupportedConfigVersionError` | `config.version` is not `1` |
| `UnknownNodeError` | A node in the graph references an unregistered `definitionId` |
| `CyclicGraphError` | The graph contains a directed cycle |
| `WebGLNotSupportedError` | The browser does not support WebGL2 |
| `ShaderCompileError` | The generated GLSL shader fails to compile |

**Example:**
```ts
import { createBackground } from 'funny-colors'
import type { BackgroundInstance } from 'funny-colors'

let bg: BackgroundInstance

try {
  bg = createBackground(canvas, config)
} catch (e) {
  if (e instanceof WebGLNotSupportedError) {
    // Show fallback
  }
  throw e
}
```

---

### `BackgroundInstance`

Returned by `createBackground`. Controls the running animation.

#### `.setParam(name: string, value: unknown): void`

Updates a named runtime parameter. Only nodes downstream of the changed parameter re-evaluate — the rest of the graph is unaffected.

```ts
bg.setParam('speed', 2.0)
bg.setParam('colorA', [1, 0.2, 0.8])
```

The `name` must match a key declared in `GraphConfig.params`. Setting an undeclared param is a no-op.

Parameter changes within a single animation frame are batched — if you call `setParam` three times before the next frame, only one re-evaluation pass occurs.

#### `.destroy(): void`

Stops the animation, removes all event listeners, releases the WebGL context, and frees all resources. Safe to call multiple times.

```ts
// On route change, component unmount, etc.
bg.destroy()
```

---

## Graph Config

The `GraphConfig` object is the contract between the visual builder and the runtime. It is a plain JSON-serialisable object.

```ts
interface GraphConfig {
  version: 1
  nodes: GraphNode[]
  edges: GraphEdge[]
  params: Record<string, unknown>
}
```

### `GraphNode`

A node instance placed in the graph.

```ts
interface GraphNode {
  instanceId: string    // unique within this graph (any string)
  definitionId: string  // references a built-in or plugin NodeDefinition.id
  position: Vec2        // x/y canvas position — ignored by runtime, used by builder
  config?: Record<string, unknown>  // per-instance configuration (e.g. paramName)
}
```

### `GraphEdge`

A connection from one node's output port to another node's input port.

```ts
interface GraphEdge {
  fromInstanceId: string
  fromPort: string
  toInstanceId: string
  toPort: string
}
```

**Rules:**
- A node's input port accepts at most one upstream connection
- Source nodes have no input ports — they cannot be the target of an edge
- Output nodes have no output ports — they cannot be the source of an edge
- Connected port types must match

### `params`

Named default values for runtime parameters. Each key becomes controllable via `bg.setParam(key, value)`.

```json
{
  "params": {
    "speed": 1.0,
    "colorA": [1, 0, 0.5],
    "intensity": 0.8
  }
}
```

A `ParamNode` in the graph reads from this store. Connect its output to any node input to expose that value to `setParam`.

---

## Built-in Nodes

All built-in nodes are also individually importable for documentation or testing purposes:

```ts
import { NoiseNode, MouseNode, RemapNode } from 'funny-colors'
```

### Source nodes

Source nodes inject live data into the graph. They have no input ports. Their data comes from the `ExecutionContext` — time, mouse position, audio, and runtime params.

#### `source/time` — TimeNode

| Port | Direction | Type | Description |
|---|---|---|---|
| `time` | output | `float` | Seconds since the background started |
| `delta` | output | `float` | Time since the last frame (seconds) |
| `cycle` | output | `float` | `time % 1.0` — repeating 0→1 every second |

#### `source/mouse` — MouseNode

| Port | Direction | Type | Description |
|---|---|---|---|
| `position` | output | `vec2` | Normalised cursor position [0,1], Y-up, relative to canvas |

Mouse tracking is automatic. No setup required.

#### `source/audio` — AudioNode

| Port | Direction | Type | Description |
|---|---|---|---|
| `bass` | output | `float` | Average energy in the low frequency band |
| `mid` | output | `float` | Average energy in the mid frequency band |
| `treble` | output | `float` | Average energy in the high frequency band |
| `raw` | output | `vec4` | `[bass, mid, treble, overall]` |

Returns zero for all outputs when no audio source is connected.

#### `source/param` — ParamNode

| Port | Direction | Type | Description |
|---|---|---|---|
| `value` | output | `float` | The current value of the named param from `GraphConfig.params` |

The param name is configured per-instance via `GraphNode.config.paramName`.

---

### Transform nodes

Transform nodes take upstream values and compute new values. They are pure — same inputs always produce the same outputs.

#### `transform/noise` — NoiseNode

| Port | Direction | Type | Default | Description |
|---|---|---|---|---|
| `position` | input | `vec2` | — | Sample position |
| `scale` | input | `float` | `1.0` | Noise frequency |
| `octaves` | input | `int` | `4` | fBm octave count |
| `seed` | input | `float` | `0` | Offset applied to position |
| `value` | output | `float` | — | Noise value in [0,1] |

Uses fractional Brownian motion (fBm) over Simplex noise.

#### `transform/math` — MathNode

| Port | Direction | Type | Default | Description |
|---|---|---|---|---|
| `a` | input | `float` | — | First operand |
| `b` | input | `float` | `0` | Second operand |
| `operation` | input | `int` | `0` | Operation index (see below) |
| `result` | output | `float` | — | Computed result |

Operations: `0` add, `1` subtract, `2` multiply, `3` divide, `4` pow, `5` min, `6` max, `7` abs(a), `8` floor(a), `9` ceil(a), `10` fract(a), `11` sqrt(a).

#### `transform/remap` — RemapNode

| Port | Direction | Type | Default | Description |
|---|---|---|---|---|
| `value` | input | `float` | — | Input value |
| `inMin` | input | `float` | `0` | Input range minimum |
| `inMax` | input | `float` | `1` | Input range maximum |
| `outMin` | input | `float` | `0` | Output range minimum |
| `outMax` | input | `float` | `1` | Output range maximum |
| `result` | output | `float` | — | Remapped value |

#### `transform/color-map` — ColorMapNode

| Port | Direction | Type | Default | Description |
|---|---|---|---|---|
| `value` | input | `float` | — | Sample position in [0,1] |
| `color` | output | `vec3` | — | Interpolated color (linear RGB) |

Color stops are configured per-instance via `GraphNode.config.stops` — an array of `[position, r, g, b]` arrays.

#### `transform/vector` — VectorNode

| Port | Direction | Type | Default | Description |
|---|---|---|---|---|
| `x` | input | `float` | `0` | X component |
| `y` | input | `float` | `0` | Y component |
| `z` | input | `float` | `0` | Z component |
| `w` | input | `float` | `0` | W component |
| `vec2` | output | `vec2` | — | `[x, y]` |
| `vec3` | output | `vec3` | — | `[x, y, z]` |
| `vec4` | output | `vec4` | — | `[x, y, z, w]` |

---

### Buffer nodes

Buffer nodes maintain state across frames, enabling effects like trails, echoes, and feedback.

#### `buffer/feedback` — FeedbackNode

| Port | Direction | Type | Default | Description |
|---|---|---|---|---|
| `input` | input | `vec4` | — | Current frame value |
| `mix` | input | `float` | `0.9` | Blend factor — higher = longer trail |
| `output` | output | `vec4` | — | `lerp(previousOutput, input, 1 - mix)` |

---

### Sampler nodes

#### `sampler/gradient` — GradientSamplerNode

| Port | Direction | Type | Description |
|---|---|---|---|
| `t` | input | `float` | Sample position in [0,1] |
| `color` | output | `vec3` | Interpolated color from the gradient |

Gradient stops are configured per-instance via `GraphNode.config.stops`.

---

### Logic nodes

#### `logic/threshold` — ThresholdNode

| Port | Direction | Type | Default | Description |
|---|---|---|---|---|
| `value` | input | `float` | — | Value to test |
| `threshold` | input | `float` | `0.5` | Comparison threshold |
| `ifAbove` | input | `float` | `1` | Output when `value > threshold` |
| `ifBelow` | input | `float` | `0` | Output when `value <= threshold` |
| `result` | output | `float` | — | Selected value |

#### `logic/switch` — SwitchNode

| Port | Direction | Type | Description |
|---|---|---|---|
| `condition` | input | `boolean` | Selector |
| `ifTrue` | input | `float` | Output when condition is true |
| `ifFalse` | input | `float` | Output when condition is false |
| `result` | output | `float` | Selected value |

---

### Output nodes

#### `output/canvas` — CanvasOutputNode

Every graph must have exactly one `CanvasOutputNode`. It is the final destination for computed values — its inputs drive the fragment shader output.

| Port | Direction | Type | Description |
|---|---|---|---|
| `color` | input | `vec3` | Final fragment color (linear RGB, 0–1) |
| `position` | input | `vec2` | UV position override (optional) |

---

## Tree-Shaking

The library is fully tree-shakeable. Unused node types are eliminated at build time when you use a modern bundler.

**Automatic** — when using `createBackground`, the bundler sees which node types are imported and eliminates the rest. No configuration needed with Vite or webpack 5+.

**Manual import** — if you import nodes directly, import only what you need:

```ts
// Good — bundler eliminates all other nodes
import { NoiseNode, ColorMapNode } from 'funny-colors'

// Also fine — but prevents tree-shaking of the nodes barrel
import * as FunnyColors from 'funny-colors'
```

**Verify your bundle** — after building, check that unused node types are absent:

```bash
# With Vite
vite build --reporter json | grep 'funny-colors'
```

---

## Third-Party Plugins

Custom node types are implemented as npm packages and registered at runtime.

```ts
import { createBackground } from 'funny-colors'
import { WobbleNode } from 'funny-colors-plugin-wobble'

const bg = createBackground(canvas, config, {
  plugins: [WobbleNode],
})
```

**Plugin rules:**
- Plugin `id` must be globally unique. Use `your-package/node-name` format.
- `evaluate` must be a pure synchronous function — no async, no DOM access, no shared state.
- Port types must use the standard `PortValueType` set (`float`, `vec2`, etc.).
- Plugins are tree-shakeable — import only the ones you use.

See `docs/contributing/writing-a-plugin.md` for full authoring instructions.

---

## Runtime Parameters

Parameters declared in `GraphConfig.params` are exposed for runtime control. They are consumed in the graph by `ParamNode` instances.

**Declare in config:**
```json
{
  "params": {
    "speed": 1.0,
    "hue": 0.5
  }
}
```

**Control at runtime:**
```ts
const bg = createBackground(canvas, config)

// Wire to a UI control
document.getElementById('speed').addEventListener('input', (e) => {
  bg.setParam('speed', parseFloat(e.target.value))
})
```

**Param types:** Parameters can be any JSON-serialisable value — `number`, `[number, number, number]` (for colors), `boolean`, etc. The `ParamNode` outputs them as `float` by default; connect to the appropriate port type.

---

## Mouse Tracking

The library automatically tracks mouse position relative to the canvas. No setup required. Access it in your graph via `MouseNode`.

Mouse coordinates are:
- Normalised to [0, 1] relative to the canvas bounding rect
- Y-axis is flipped: `0` = bottom, `1` = top (matches GLSL convention)
- Updated on `mousemove` events on the canvas element

---

## Error Handling

All errors thrown by the library are named classes exported from the package root:

```ts
import {
  UnsupportedConfigVersionError,
  UnknownNodeError,
  CyclicGraphError,
  WebGLNotSupportedError,
  ShaderCompileError,
} from 'funny-colors'
```

**Recommended pattern:**

```ts
import {
  createBackground,
  WebGLNotSupportedError,
  ShaderCompileError,
} from 'funny-colors'

try {
  const bg = createBackground(canvas, config)
} catch (e) {
  if (e instanceof WebGLNotSupportedError) {
    showStaticFallback()
  } else if (e instanceof ShaderCompileError) {
    console.error(`Shader ${e.stage} failed:`, e.message)
  } else {
    throw e
  }
}
```

---

## CLI

The CLI produces a self-contained JS bundle — no npm install required on the target page.

```bash
npx funny-colors build my-graph.json
# → my-graph.bundle.js

npx funny-colors build my-graph.json --out ./dist/bg.js
npx funny-colors build my-graph.json --target webgpu   # (future)
```

The bundle includes only the node types referenced by the graph. Embed it directly:

```html
<canvas id="bg" width="1920" height="1080"></canvas>
<script src="my-graph.bundle.js"></script>
```

---

## Browser Compatibility

| Feature | Minimum version |
|---|---|
| Chrome | 56 (WebGL2) |
| Firefox | 51 (WebGL2) |
| Safari | 15 (WebGL2) |
| Edge | 79 (WebGL2, Chromium) |

The library **does not polyfill**. If WebGL2 is unavailable, `WebGLNotSupportedError` is thrown synchronously by `createBackground`. Handle this in your application code to display a fallback.

---

## TypeScript

The library ships with full TypeScript declarations. All types used in the public API are exported:

```ts
import type {
  GraphConfig,
  GraphNode,
  GraphEdge,
  BackgroundInstance,
  NodeDefinition,
  TransformNodeDefinition,
  SourceNodeDefinition,
  BufferNodeDefinition,
  ExecutionContext,
  PortSchema,
  PortValues,
  PortValueType,
} from 'funny-colors'
```

Strict TypeScript is enforced throughout the library. The `NodeDefinition` discriminated union gives exhaustive type narrowing:

```ts
function describeNode(def: NodeDefinition): string {
  switch (def.type) {
    case 'source': return `Source: ${def.label}`
    case 'buffer': return `Buffer: ${def.label} (stateful)`
    // TypeScript enforces all 7 cases
  }
}
```

---

## Performance Notes

- **DAG evaluation** runs in JS each frame (~0.1–1ms for typical graphs). The GPU does the heavy lifting.
- **Dirty flagging** skips unchanged nodes — `setParam` only re-evaluates the affected subgraph.
- **Tree-shaking** — a minimal graph (TimeNode → NoiseNode → OutputNode) adds ~8kb gzipped to your bundle.
- **Buffer nodes** are the only nodes with per-frame allocation (their `FrameState`). Keep buffer node counts low for maximum performance.
- **WebGL2** renders a single fullscreen triangle per frame — draw call overhead is minimal.
