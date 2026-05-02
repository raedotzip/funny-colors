# funny-colors — System Technical Specification

**Version:** 0.1  
**Status:** Living document — update when architecture changes, create an ADR for every decision that alters this spec.

---

## 1. Purpose

This document is the canonical technical reference for the funny-colors system. It describes the full architecture, data flow, execution model, type contracts, rendering pipeline, plugin system, testing strategy, and build system in one place.

Read this before starting any implementation phase. Cross-reference with the ADR index (`docs/adr/README.md`) for the reasoning behind each decision.

---

## 2. System Overview

funny-colors is a **plugin-based procedural background generation system** with two surfaces:

| Surface | Audience | Artifact |
|---|---|---|
| Visual builder (`apps/web`) | Designers, non-developers | Web app — compose node graphs, preview live output, export config |
| npm library (`funny-colors`) | Developers | npm package — embed the background on any site |

The two surfaces share a **serialised graph config** (`GraphConfig` JSON) as their contract. The builder produces it; the runtime consumes it.

```
┌─────────────────────────────────────────────────────────────────┐
│                        apps/web (builder)                        │
│                                                                  │
│  Node Palette → Graph Canvas → Inspector → Preview → Export      │
└──────────────────────────────┬──────────────────────────────────┘
                               │  GraphConfig JSON
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    funny-colors (runtime)                        │
│                                                                  │
│  createBackground(canvas, config)                                │
│    → DAG engine (@funny-colors/core)                             │
│    → Node library (@funny-colors/nodes)                          │
│    → WebGL renderer (@funny-colors/renderer)                     │
│    → AnimationFrame loop → pixels on canvas                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Package Architecture

### Dependency graph (strict — no cycles permitted)

```
funny-colors (public)
├── @funny-colors/core
├── @funny-colors/nodes ──► @funny-colors/core
└── @funny-colors/renderer ──► @funny-colors/core

apps/web
├── @funny-colors/core
├── @funny-colors/nodes
└── @funny-colors/renderer
```

`@funny-colors/core` has **zero runtime dependencies**. This is a hard constraint — it must stay that way.

### Package responsibilities

| Package | Single responsibility |
|---|---|
| `@funny-colors/core` | DAG engine, type system, param store |
| `@funny-colors/nodes` | Built-in node implementations |
| `@funny-colors/renderer` | Graphics backend abstraction + WebGL |
| `funny-colors` | Public re-export, `createBackground`, CLI |
| `apps/web` | Visual builder |
| `@funny-colors/tsconfig` | Shared TypeScript presets |

---

## 4. Type System

All public types are defined in `@funny-colors/core/src/types.ts`. This is the single source of truth. No other package defines public types independently.

### 4.1 Port types

Values that flow between nodes. These map directly to GLSL types in the compiled shader.

| `PortValueType` | JS representation | GLSL type |
|---|---|---|
| `float` | `number` | `float` |
| `int` | `number` (integer) | `int` |
| `boolean` | `boolean` | `bool` |
| `vec2` | `[number, number]` | `vec2` |
| `vec3` | `[number, number, number]` | `vec3` |
| `vec4` | `[number, number, number, number]` | `vec4` |
| `color` | `[number, number, number]` (linear 0–1) | `vec3` |

### 4.2 Node taxonomy

Seven node types enforced as a TypeScript discriminated union on the `type` field:

```
NodeDefinition =
  | SourceNodeDefinition      (type: 'source')
  | TransformNodeDefinition   (type: 'transform')
  | BufferNodeDefinition      (type: 'buffer')
  | SamplerNodeDefinition     (type: 'sampler')
  | LogicNodeDefinition       (type: 'logic')
  | GroupNodeDefinition       (type: 'group')
  | OutputNodeDefinition      (type: 'output')
```

All types share `BaseNodeDefinition`:

```
BaseNodeDefinition {
  id: string             — globally unique, use 'scope/name' format
  type: NodeType         — discriminant
  label: string          — shown in builder palette
  inputs: PortSchema[]   — declared input ports
  outputs: PortSchema[]  — declared output ports
  evaluate(inputs: PortValues, ctx: ExecutionContext): PortValues
}
```

Type-specific extensions:

| Type | Additional fields | Input constraint | Output constraint |
|---|---|---|---|
| `source` | none | `inputs: []` enforced | — |
| `transform` | none | — | — |
| `buffer` | `initState(): FrameState` | — | — |
| `sampler` | none | — | — |
| `logic` | none | — | — |
| `group` | `subgraph: GraphConfig` | — | — |
| `output` | none | — | `outputs: []` enforced |

### 4.3 Execution context

Injected into every node's `evaluate` call each frame. Source nodes use it as their primary data source. All other node types receive it but typically ignore it.

```
ExecutionContext {
  time: number                    — seconds since background started
  mouse: [number, number]         — normalised [0,1] relative to canvas, Y-up
  audio: Float32Array | null      — frequency data from Web Audio AnalyserNode
  canvas: { width: number; height: number }
  params: Record<string, unknown> — named runtime params from setParam()
}
```

### 4.4 Graph config

The serialised user graph. Produced by the builder; consumed by the runtime. **This is a public, versioned schema.**

```
GraphConfig {
  version: 1                  — bump on breaking schema changes
  nodes: GraphNode[]          — node instances placed in the graph
  edges: GraphEdge[]          — port connections between instances
  params: Record<string, unknown>  — named runtime param defaults
}

GraphNode {
  instanceId: string          — unique within this graph
  definitionId: string        — references a NodeDefinition.id
  position: Vec2              — canvas position (builder only, ignored by runtime)
  config?: Record<string, unknown>  — per-instance config (e.g. paramName for ParamNode)
}

GraphEdge {
  fromInstanceId: string
  fromPort: string
  toInstanceId: string
  toPort: string
}
```

---

## 5. Execution Model

### 5.1 DAG evaluation

The runtime evaluates the node graph as a DAG every animation frame.

**Step 1 — Build evaluation order (once, at startup)**

Kahn's algorithm performs a topological sort on the graph. Output is an ordered list of `instanceId` strings. Source nodes always appear first; Output nodes always appear last. Throws `CyclicGraphError` if a cycle is detected.

**Step 2 — Per-frame evaluation**

```
for each instanceId in evaluationOrder:
  if node is clean AND node.type !== 'source':
    skip                          ← dirty flagging optimisation

  resolve inputs:
    for each input port:
      if an upstream edge exists → use cached output value from upstream node
      else → use port.default

  dispatch by node.type:
    'source'  → evaluate({}, ctx)                     ← ctx is the data source
    'buffer'  → evaluate(inputs, ctx) with frameState ← stateful
    others    → evaluate(inputs, ctx)

  cache output PortValues for downstream nodes
  mark node clean
```

**Step 3 — Shader render**

The Output node's resolved inputs are passed as uniforms to the compiled WebGL program. The program runs once per frame via `gl.drawArrays`.

### 5.2 Dirty flagging

Nodes start dirty. After evaluation, a node is marked clean. It stays clean until:
- A Source node always re-evaluates (ctx changes every frame)
- `setParam()` is called → the ParamNode and all transitive descendants are marked dirty
- A new edge is connected → all nodes downstream of the new connection are marked dirty

`markDirty(instanceId)` walks the edge list forward (breadth-first) and marks all reachable nodes dirty.

### 5.3 Buffer node state

Buffer nodes own a `FrameState` object across frames. The DAG runner:
- Calls `initState()` once at construction and stores the result
- Passes current `FrameState` to `evaluate` on each frame
- Stores the updated state returned by `evaluate`

This is the only mutable state in the execution model.

### 5.4 Param store

```
setParam('speed', 2.0)
  → paramStore.set('speed', 2.0)
  → onChange listener fires
  → DAG runner calls markDirty(paramNodeInstanceId)
  → next frame: ParamNode and descendants re-evaluate
```

Multiple `setParam` calls within a single frame are batched — dirty marking runs once per `requestAnimationFrame`, not once per `set` call.

---

## 6. Rendering Pipeline

### 6.1 Backend abstraction

The `RendererBackend` interface decouples the DAG compiler from the graphics API:

```
RendererBackend {
  compile(canvas: HTMLCanvasElement, fragSrc: string): CompiledProgram
  destroy(): void
}

CompiledProgram {
  render(uniforms: Record<string, UniformValue>): void
  destroy(): void
}
```

Current backend: `WebGLBackend`. Future backend: `WebGPUBackend`. Switching backends requires only a new implementation of this interface — core and nodes are unaffected.

### 6.2 WebGL backend

**Context:** Always WebGL2 (`canvas.getContext('webgl2')`). Throws `WebGLNotSupportedError` if unavailable.

**Vertex shader (fullscreen quad, no geometry buffer needed):**
```glsl
#version 300 es
out vec2 vUv;
void main() {
  vec2 pos = vec2((gl_VertexID & 1) * 2 - 1, (gl_VertexID >> 1) * 2 - 1);
  vUv = pos * 0.5 + 0.5;
  gl_Position = vec4(pos, 0.0, 1.0);
}
```
`gl.drawArrays(GL_TRIANGLES, 0, 3)` — no VAO, no buffers.

**Fragment shader structure:**
```glsl
#version 300 es
precision highp float;

// Math preamble (noise, color utils, etc.)
[concatenated GLSL from @funny-colors/renderer/math]

// Standard uniforms (always present)
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;

// Graph-derived uniforms (one per exposed param)
uniform float u_param_speed;

in vec2 vUv;
out vec4 fragColor;

void main() {
  // Generated from DAG traversal — emitted by DAG compiler
  [node output GLSL expressions]
  fragColor = vec4(finalColor, 1.0);
}
```

**Uniform type dispatch:**

| JS value | WebGL call |
|---|---|
| `number` | `uniform1f` |
| `[n, n]` | `uniform2fv` |
| `[n, n, n]` | `uniform3fv` |
| `[n, n, n, n]` | `uniform4fv` |
| `Float32Array` (len 16) | `uniformMatrix4fv` |

### 6.3 GLSL math library

Maintained in `@funny-colors/renderer/src/math/`. Exported as TypeScript string constants concatenated into the shader preamble.

| Constant | GLSL function |
|---|---|
| `FBM_GLSL` | `float fbm(vec2 p)` — fractional Brownian motion |
| `SIMPLEX_GLSL` | `float simplex(vec2 p)` — Simplex noise |
| `WORLEY_GLSL` | `float worley(vec2 p)` — Worley/cellular noise |
| `HSV_TO_RGB_GLSL` | `vec3 hsv2rgb(vec3 c)` |
| `RGB_TO_HSV_GLSL` | `vec3 rgb2hsv(vec3 c)` |
| `LINEAR_TO_SRGB_GLSL` | `vec3 linearToSrgb(vec3 c)` |
| `REMAP_GLSL` | `float remap(float v, float inMin, float inMax, float outMin, float outMax)` |
| `ROTATE2D_GLSL` | `mat2 rotate2d(float angle)` |

---

## 7. Plugin System

### 7.1 Plugin contract

A plugin is an npm package exporting one or more `NodeDefinition` objects. The `evaluate` function is a pure function — no classes, no lifecycle, no shared state.

```ts
const MyNode: TransformNodeDefinition = {
  id: 'my-package/my-node',   // globally unique — namespace with package name
  type: 'transform',
  label: 'My Node',
  inputs: [{ name: 'value', type: 'float', default: 0 }],
  outputs: [{ name: 'result', type: 'float' }],
  evaluate({ value }) {
    return { result: Math.sin(value as number) }
  },
}
```

### 7.2 Node registry

The runtime maintains a `NodeRegistry` — a map from `definitionId` to `NodeDefinition`. Built-in nodes are pre-registered from `@funny-colors/nodes`. Third-party plugins are registered via the `plugins` option on `createBackground`.

```ts
createBackground(canvas, config, {
  plugins: [MyNode, AnotherNode],
})
```

An unregistered `definitionId` in a graph throws `UnknownNodeError` at startup.

### 7.3 Plugin isolation

Plugins have no access to each other's state, the DOM, or the WebGL context. Their `evaluate` function receives only `PortValues` and `ExecutionContext`. This is structural isolation — no sandbox, but no shared mutable state by design.

---

## 8. Built-in Nodes

### Source nodes
| Node | id | Outputs |
|---|---|---|
| `MouseNode` | `source/mouse` | `position: vec2` |
| `AudioNode` | `source/audio` | `bass: float`, `mid: float`, `treble: float`, `raw: vec4` |
| `TimeNode` | `source/time` | `time: float`, `delta: float`, `cycle: float` |
| `ParamNode` | `source/param` | `value: float` |

### Transform nodes
| Node | id | Key inputs | Output |
|---|---|---|---|
| `NoiseNode` | `transform/noise` | `position: vec2`, `scale: float`, `octaves: int` | `value: float` |
| `MathNode` | `transform/math` | `a: float`, `b: float`, `operation: int` | `result: float` |
| `ColorMapNode` | `transform/color-map` | `value: float`, `stops: vec4[]` | `color: vec3` |
| `RemapNode` | `transform/remap` | `value`, `inMin`, `inMax`, `outMin`, `outMax: float` | `result: float` |
| `VectorNode` | `transform/vector` | `x`, `y`, `z`, `w: float` | `vec2`, `vec3`, `vec4` |

### Buffer nodes
| Node | id | Description |
|---|---|---|
| `FeedbackNode` | `buffer/feedback` | Blends current input with previous frame output |

### Sampler nodes
| Node | id | Description |
|---|---|---|
| `GradientSamplerNode` | `sampler/gradient` | Samples a color stop gradient at `t: float` |

### Logic nodes
| Node | id | Description |
|---|---|---|
| `ThresholdNode` | `logic/threshold` | Outputs `ifAbove` or `ifBelow` based on threshold comparison |
| `SwitchNode` | `logic/switch` | Selects between two values based on a boolean |

### Output nodes
| Node | id | Description |
|---|---|---|
| `CanvasOutputNode` | `output/canvas` | Marker node — signals the DAG compiler to emit fragment shader output |

---

## 9. Graph Editor (Builder)

### 9.1 GraphEditorAdapter interface

The builder's graph canvas is abstracted behind `GraphEditorAdapter` (defined in `@funny-colors/core`). The only file that imports xyflow is `apps/web/src/adapters/xyflow-adapter.ts`. Swapping the graph editor requires replacing only that file.

```
GraphEditorAdapter {
  mount(container: HTMLElement): void
  setNodes(nodes: GraphNode[]): void
  setEdges(edges: GraphEdge[]): void
  onConnect(cb: (from: PortRef, to: PortRef) => void): void
  onNodeMove(cb: (instanceId: string, pos: Vec2) => void): void
  destroy(): void
}
```

### 9.2 Builder state machine

The builder has a single `BuilderState` object. Mutations go through a pure `dispatch(state, action) → BuilderState` reducer — no direct mutation.

```
BuilderState {
  nodes: GraphNode[]
  edges: GraphEdge[]
  params: Record<string, unknown>
  selectedNodeId: string | null
  isDirty: boolean
}
```

Actions: `ADD_NODE`, `MOVE_NODE`, `DELETE_NODE`, `CONNECT_PORTS`, `DISCONNECT_EDGE`, `SELECT_NODE`, `SET_PARAM`, `LOAD_CONFIG`, `MARK_SAVED`.

**Validation enforced in `CONNECT_PORTS`:**
- Source and target port types must match
- No duplicate edges on the same input port (one upstream per input)
- Source nodes' `inputs: []` — cannot be connected to
- Output nodes' `outputs: []` — cannot be connected from
- No self-connections

### 9.3 Live preview

`PreviewManager` wraps `createBackground`. On every state change, it calls `preview.update(config)` — debounced 300ms to avoid recompiling mid-connection. `update` destroys the existing instance and creates a new one.

### 9.4 Export

`exportConfig(state: BuilderState): GraphConfig` strips UI-only fields (`selectedNodeId`, `isDirty`, `position`) and serialises to the versioned JSON schema.

---

## 10. Public API

### 10.1 `createBackground`

```ts
function createBackground(
  canvas: HTMLCanvasElement,
  config: GraphConfig,
  options?: { plugins?: NodeDefinition[] }
): BackgroundInstance
```

**Startup sequence:**
1. Validate `config.version === 1` — throw `UnsupportedConfigVersionError` otherwise
2. Build `NodeRegistry` from built-ins + `options.plugins`
3. Validate all `definitionId`s in config are registered
4. Create `ParamStore` from `config.params`
5. Call `buildEvaluationOrder(config)` — throw `CyclicGraphError` on cycle
6. Create `DagRunner`
7. Compile fragment shader via `WebGLBackend`
8. Attach `mousemove` listener to canvas
9. Start `requestAnimationFrame` loop
10. Return `BackgroundInstance`

**Returns:**
```ts
BackgroundInstance {
  setParam(name: string, value: unknown): void
  destroy(): void
}
```

`destroy()` cancels the RAF loop, removes event listeners, destroys the compiled program and WebGL context. Calling `destroy()` twice is a no-op.

### 10.2 CLI

```
npx funny-colors build <graph.json> [--out <file.js>] [--target webgl|webgpu]
```

Bundles `createBackground` + the node types referenced by the graph into a self-contained JS file. Uses esbuild internally.

---

## 11. Testing Architecture

### 11.1 Principles

- Test external behaviour, not implementation details
- Node `evaluate` functions: call with inputs, assert outputs — no mocks needed
- DAG engine: construct a real graph, run it, assert the Output node received correct values
- Never assert on internal state, call counts, or private variables

### 11.2 Test matrix

| Layer | Runner | Environment | Coverage target |
|---|---|---|---|
| `@funny-colors/core` — types | Vitest | Node | compile-time (`@ts-expect-error`) |
| `@funny-colors/core` — DAG | Vitest | Node | ≥95% |
| `@funny-colors/core` — param store | Vitest | Node | ≥95% |
| `@funny-colors/renderer` — math | Vitest | Node | ≥95% |
| `@funny-colors/renderer` — WebGL | Vitest browser + Playwright | Chromium | ≥90% |
| `@funny-colors/nodes` — all nodes | Vitest | Node | ≥95% |
| `funny-colors` — runtime | Vitest browser + Playwright | Chromium | ≥90% |
| `apps/web` — builder state | Vitest | Node | ≥85% |
| `apps/web` — XyflowAdapter | Vitest browser | Chromium | ≥85% |
| `apps/web` — E2E | Playwright | Chromium | — |
| `apps/web` — visual regression | Playwright | Chromium | — |

### 11.3 Shared test fixtures

`@funny-colors/nodes/src/test-utils.ts` exports:
- `mockCtx: ExecutionContext` — stable mock context for node unit tests
- `makeGraph(nodes, edges): GraphConfig` — test graph builder helper

---

## 12. Build System

### 12.1 Tooling

| Tool | Role |
|---|---|
| pnpm | Package manager, workspace linking |
| Turborepo | Task orchestration, build caching |
| tsup (esbuild) | Library bundler — CJS + ESM + `.d.ts` |
| Vite | `apps/web` dev server and app build |
| TypeScript | Strict mode, project references for IDE |
| Vitest | Unit and integration tests |
| Playwright | Browser-mode tests, E2E, visual regression |

### 12.2 Turbo task graph

```
build  → depends on ^build (upstream packages must build first)
test   → depends on ^build (type declarations must exist)
lint   → independent
typecheck → independent
clean  → independent, no cache
```

### 12.3 TypeScript config

Three presets in `@funny-colors/tsconfig`:

| Preset | Used by | Key settings |
|---|---|---|
| `base.json` | All | `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, ESNext modules |
| `lib.json` | Library packages | Extends base + `composite: true` |
| `app.json` | `apps/web` | Extends base + DOM libs + `noEmit: true` |

### 12.4 Output format

All library packages emit:
- `dist/index.js` — ESM (primary, tree-shakeable)
- `dist/index.cjs` — CJS (for non-ESM consumers)
- `dist/index.d.ts` — TypeScript declarations

`package.json` `exports` field routes bundlers to the correct format.

---

## 13. Error Catalogue

All errors are named classes exported from the relevant package.

| Error | Package | Thrown when |
|---|---|---|
| `CyclicGraphError` | `@funny-colors/core` | `buildEvaluationOrder` detects a cycle |
| `UnknownNodeError` | `@funny-colors/core` | A `definitionId` in the graph has no registered `NodeDefinition` |
| `UnsupportedConfigVersionError` | `funny-colors` | `GraphConfig.version !== 1` |
| `WebGLNotSupportedError` | `@funny-colors/renderer` | `canvas.getContext('webgl2')` returns null |
| `ShaderCompileError` | `@funny-colors/renderer` | GLSL compilation or linking fails |

All errors include a descriptive `.message`. `ShaderCompileError` includes a `.stage` field (`'vertex' \| 'fragment' \| 'link'`).

---

## 14. Browser Compatibility

| Feature | Requirement |
|---|---|
| WebGL2 | Chrome 56+, Firefox 51+, Safari 15+, Edge 79+ |
| ES2022 | All modern browsers |
| Web Audio API | All modern browsers (AudioNode only) |
| WebGPU | Chrome 113+, Safari 18+ (future backend) |

The library does not polyfill. If `WebGL2` is unavailable, `WebGLNotSupportedError` is thrown. The host application is responsible for graceful degradation.

---

## 15. Versioning & Stability

| Contract | Stability |
|---|---|
| `GraphConfig` JSON schema | Public — breaking changes require major version bump |
| `BackgroundInstance` API | Public — breaking changes require major version bump |
| `NodeDefinition` interface | Public — breaking changes require major version bump |
| `@funny-colors/core` type exports | Public |
| `@funny-colors/nodes` named exports | Public |
| `@funny-colors/renderer` `RendererBackend` | Internal — may change without major bump |
| `apps/web` internals | Private |

Internal packages (`@funny-colors/core`, `@funny-colors/nodes`, `@funny-colors/renderer`) are published as private workspace packages and are not directly installable by end users. Only `funny-colors` is public on npm.

---

## 16. Future Work (Out of Scope for v0.1)

- WebGPU backend (`packages/renderer/src/webgpu/`)
- Audio input wiring in `createBackground`
- `lib/compute` — Rust/WASM compute backend
- Plugin registry / discovery in the builder
- Graph versioning / migration between `GraphConfig` versions
- React/Vue wrapper components
- Undo/redo in the builder
- Server-side graph evaluation
