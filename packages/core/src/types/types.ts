/**
 * @fileoverview Public type contracts for `@funny-colors/core`.
 *
 * Every interface, type alias, and discriminated union used across the
 * funny-colors system is declared here. No executable code lives in this
 * file — it is pure TypeScript declarations.
 *
 * **Dependency rule:** All other packages import from this module. This module
 * imports from nothing. Circular imports are therefore impossible.
 *
 * @remarks
 * The type system is organised into four layers:
 *
 * 1. **Port contracts** — `PortValueType`, `PortSchema`, `PortValues`.
 *    Define what data can flow between nodes.
 *
 * 2. **Execution context** — `ExecutionContext`, `FrameState`.
 *    Define what data the runtime provides to nodes each frame.
 *
 * 3. **Node taxonomy** — `BaseNodeDefinition` and its seven subtypes,
 *    `NodeDefinition`, `NodeType`.
 *    Define the shape every node plugin must conform to.
 *
 * 4. **Graph contracts** — `Vec2`, `GraphNode`, `GraphEdge`, `GraphConfig`.
 *    Define the serialised format the builder produces and the runtime consumes.
 *
 * 5. **Runtime API** — `PortRef`, `GraphEditorAdapter`, `BackgroundInstance`.
 *    Define the public surfaces that host pages and the web builder depend on.
 *
 * @see {@link NodeDefinition} — discriminated union of all 7 node types
 * @see {@link GraphConfig} — serialised graph produced by the builder
 * @see {@link ExecutionContext} — per-frame data injected into Source nodes
 * @see {@link BackgroundInstance} — public API returned by `createBackground`
 *
 * @module
 */

// ---------------------------------------------------------------------------
// Port contracts
// ---------------------------------------------------------------------------

/**
 * The set of scalar and vector value types that can flow through node ports.
 *
 * These map directly to GLSL / WGSL primitive types in the renderer:
 * - `float` → `float` / `f32`
 * - `vec2` → `vec2` / `vec2<f32>`
 * - `vec3` → `vec3` / `vec3<f32>`
 * - `vec4` → `vec4` / `vec4<f32>`
 * - `color` → `vec3` (linear RGB, same storage as `vec3`)
 * - `boolean` → `bool`
 * - `int` → `int` / `i32`
 *
 * @remarks
 * `color` is semantically distinct from `vec3` in the UI (the builder shows a
 * colour picker rather than three number inputs) but uses identical GPU storage.
 * The renderer is responsible for the distinction.
 *
 * @see {@link PortSchema}
 */
export type PortValueType =
  | 'float'
  | 'vec2'
  | 'vec3'
  | 'vec4'
  | 'color'
  | 'boolean'
  | 'int'

/**
 * Declares a single input or output port on a node definition.
 *
 * Port schemas are static — they are declared once on the `NodeDefinition` and
 * never change at runtime. The DAG runner reads them to resolve input values
 * for each evaluation cycle.
 *
 * @remarks
 * `default` is only meaningful on input ports. Output ports never need a
 * default because their value is always produced by `evaluate`. Autodoc tools
 * should note that `default` is typed `unknown` intentionally — its runtime
 * shape must match `type` but TypeScript cannot enforce that relationship.
 *
 * @example
 * ```ts
 * const speedPort: PortSchema = {
 *   name: 'speed',
 *   type: 'float',
 *   default: 1.0,
 * }
 * ```
 *
 * @see {@link PortValueType}
 * @see {@link PortValues}
 */
export interface PortSchema {
  /** The port's identifier. Must be unique within its node's `inputs` or `outputs` array. */
  name: string
  /** The data type carried by this port. Determines UI widget and GPU type. */
  type: PortValueType
  /**
   * Fallback value used by `DagRunner` when no upstream edge connects to this
   * input port. Omit on output ports — they are always produced by `evaluate`.
   *
   * The value must be compatible with `type` at runtime; TypeScript cannot
   * verify this statically because of the `unknown` type.
   */
  default?: unknown
}

/**
 * A runtime map of port names to their resolved values.
 *
 * `DagRunner` builds a `PortValues` object for each node on every frame by
 * resolving each input port either from the upstream node's cached output or
 * from the port's declared `default`. The same type is returned by `evaluate`
 * to represent a node's outputs.
 *
 * @remarks
 * Values are typed `unknown` because the DAG engine is type-agnostic — it
 * passes values through without inspecting them. Individual node `evaluate`
 * implementations are responsible for casting to the expected types.
 *
 * @example
 * ```ts
 * // Inside a node's evaluate function:
 * evaluate({ speed, hue }: PortValues) {
 *   return { result: (speed as number) * (hue as number) }
 * }
 * ```
 *
 * @see {@link PortSchema}
 */
export type PortValues = Record<string, unknown>

// ---------------------------------------------------------------------------
// Execution context
// ---------------------------------------------------------------------------

/**
 * Per-frame data provided by the runtime to every Source node's `evaluate`
 * call.
 *
 * `ExecutionContext` is constructed once per animation frame by the runtime and
 * passed to `DagRunner.evaluate`. Source nodes read from it instead of
 * receiving upstream `PortValues` (their `inputs` array is always empty).
 * Non-source nodes receive it as the second argument to `evaluate` but
 * typically use it only for time or canvas dimensions.
 *
 * @remarks
 * `params` is a snapshot of `ParamStore` at frame time. It is a plain object
 * copy — mutations do not propagate back to the store.
 *
 * @example
 * ```ts
 * const ctx: ExecutionContext = {
 *   time: performance.now() / 1000,
 *   mouse: [mx / canvas.width, my / canvas.height],
 *   audio: analyser ? analyserData : null,
 *   canvas: { width: gl.drawingBufferWidth, height: gl.drawingBufferHeight },
 *   params: paramStore.snapshot(),
 * }
 * runner.evaluate(ctx)
 * ```
 *
 * @see {@link SourceNodeDefinition}
 * @see {@link ParamStore}
 */
export interface ExecutionContext {
  /**
   * Elapsed time in seconds since `createBackground` was called.
   * Typically derived from `performance.now()` divided by 1000.
   */
  time: number
  /**
   * Normalised mouse position relative to the canvas, in the range [0, 1] on
   * both axes. `[0, 0]` is the top-left corner.
   */
  mouse: [number, number]
  /**
   * Current audio frequency data from a connected `AnalyserNode`, or `null`
   * if no audio source is active. The array length equals the FFT bin count
   * configured on the analyser.
   */
  audio: Float32Array | null
  /** Current canvas dimensions in CSS pixels (not device pixels). */
  canvas: { width: number; height: number }
  /**
   * Snapshot of all named runtime params at the current frame, populated from
   * `ParamStore.snapshot()`. Keys match those declared in `GraphConfig.params`.
   *
   * @see {@link GraphConfig}
   */
  params: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Node type interfaces (discriminated union)
// ---------------------------------------------------------------------------

/**
 * Shared contract for all node types.
 *
 * `BaseNodeDefinition` is intentionally not exported — callers work with the
 * concrete subtypes or the `NodeDefinition` union. It exists so the subtypes
 * can share common properties without repeating them.
 *
 * @internal
 *
 * @see {@link NodeDefinition}
 * @see {@link TransformNodeDefinition}
 * @see {@link SourceNodeDefinition}
 * @see {@link BufferNodeDefinition}
 */
interface BaseNodeDefinition {
  /**
   * Globally unique, stable identifier for this node type.
   *
   * Convention: `"category/name"` (e.g. `"noise/fbm"`, `"math/add"`).
   * Must never change across library versions — graph configs saved by users
   * reference this id to locate the definition.
   */
  id: string
  /** Discriminant used by `DagRunner` and the builder to dispatch by node type. */
  type: NodeType
  /** Human-readable label displayed in the builder UI node palette and canvas. */
  label: string
  /**
   * Ordered list of input port schemas. The DAG runner iterates this to
   * resolve input values before each `evaluate` call.
   *
   * Source nodes must declare `inputs: []` (empty tuple).
   */
  inputs: PortSchema[]
  /**
   * Ordered list of output port schemas. The builder uses this to render
   * output handles on the node card. Values are populated by `evaluate`.
   *
   * Output nodes must declare `outputs: []` (empty tuple).
   */
  outputs: PortSchema[]
  /**
   * Pure function called by `DagRunner` once per frame for dirty nodes.
   *
   * - `inputs` — resolved upstream values, keyed by port name. Source nodes
   *   always receive an empty object; their data comes from `ctx`.
   * - `ctx` — per-frame execution context (time, mouse, audio, canvas, params).
   *
   * Must return a `PortValues` map whose keys match the node's `outputs` schema.
   * The function must be pure — no side effects, no shared mutable state.
   *
   * @param inputs - Resolved input port values (empty for Source nodes).
   * @param ctx - Current frame's execution context.
   * @returns Output port values for downstream nodes to consume.
   */
  evaluate(inputs: PortValues, ctx: ExecutionContext): PortValues
}

/**
 * A stateless node that transforms upstream inputs into new output values.
 *
 * Transform nodes are the most common node type. They receive values from
 * upstream nodes, apply a pure function, and pass results downstream.
 * They have no side effects and no persistent state.
 *
 * @remarks
 * Transform nodes are subject to dirty flagging — if none of their upstream
 * dependencies changed, `DagRunner` skips them entirely for the frame.
 *
 * @example
 * ```ts
 * const addNode: TransformNodeDefinition = {
 *   id: 'math/add',
 *   type: 'transform',
 *   label: 'Add',
 *   inputs: [
 *     { name: 'a', type: 'float', default: 0 },
 *     { name: 'b', type: 'float', default: 0 },
 *   ],
 *   outputs: [{ name: 'result', type: 'float' }],
 *   evaluate({ a, b }) {
 *     return { result: (a as number) + (b as number) }
 *   },
 * }
 * ```
 *
 * @see {@link NodeDefinition}
 * @see {@link BaseNodeDefinition}
 */
export interface TransformNodeDefinition extends BaseNodeDefinition {
  type: 'transform'
}

/**
 * A node that reads from the external world (`ExecutionContext`) rather than
 * from upstream nodes.
 *
 * Source nodes are the entry points for real-time data: time, mouse position,
 * audio frequency, or named runtime params. They always re-evaluate every
 * frame because `ExecutionContext` changes on each tick — dirty flagging is
 * not applied to them.
 *
 * @remarks
 * `inputs` must be the empty tuple `[]`. The TypeScript type system enforces
 * this at compile time. Source nodes receive an empty object as their `inputs`
 * argument; all data comes from `ctx`.
 *
 * @example
 * ```ts
 * const timeSource: SourceNodeDefinition = {
 *   id: 'source/time',
 *   type: 'source',
 *   label: 'Time',
 *   inputs: [],
 *   outputs: [{ name: 'time', type: 'float' }],
 *   evaluate(_, ctx) {
 *     return { time: ctx.time }
 *   },
 * }
 * ```
 *
 * @see {@link ExecutionContext}
 * @see {@link NodeDefinition}
 */
export interface SourceNodeDefinition extends BaseNodeDefinition {
  type: 'source'
  /**
   * Always the empty tuple. Source nodes receive no values from upstream
   * nodes — their data comes exclusively from `ExecutionContext`.
   */
  inputs: []
}

/**
 * A stateful node that accumulates per-instance state across frames.
 *
 * Buffer nodes are used for effects that require memory of previous frames:
 * feedback loops, trail effects, ping-pong FBO operations, or any
 * accumulating value. Like Source nodes, they always re-evaluate every frame
 * because their state changes with each evaluation.
 *
 * @remarks
 * **State lifecycle:**
 * 1. `initState()` is called once when `DagRunner` is constructed.
 * 2. On each frame, the stored state is passed as the third argument to `evaluate`.
 * 3. If `evaluate` returns a key `__nextFrameState`, its value replaces the
 *    stored state for the following frame. If the key is absent, state is
 *    left unchanged.
 *
 * `__nextFrameState` is an internal convention between `dag.ts` and buffer node
 * authors — it is not part of any public type.
 *
 * **Type override:** `BufferNodeDefinition` uses `Omit<BaseNodeDefinition, 'evaluate'>`
 * as its base so that the 3-argument `evaluate` signature does not conflict
 * with the 2-argument base signature.
 *
 * @example
 * ```ts
 * const counterBuffer: BufferNodeDefinition = {
 *   id: 'buffer/counter',
 *   type: 'buffer',
 *   label: 'Counter',
 *   inputs: [],
 *   outputs: [{ name: 'count', type: 'float' }],
 *   initState: () => ({ count: 0 }),
 *   evaluate(_, _ctx, state) {
 *     const next = (state as { count: number }).count + 1
 *     return { count: next, __nextFrameState: { count: next } }
 *   },
 * }
 * ```
 *
 * @see {@link FrameState}
 * @see {@link NodeDefinition}
 */
export interface BufferNodeDefinition extends Omit<BaseNodeDefinition, 'evaluate'> {
  type: 'buffer'
  /**
   * Factory called exactly once during `DagRunner` construction to produce the
   * initial per-instance frame state.
   *
   * Each `GraphNode` that uses this definition gets its own independent state
   * object — definitions are shared but state is per-instance.
   *
   * @returns The initial `FrameState` for one graph instance of this node.
   *
   * @see {@link FrameState}
   */
  initState(): FrameState
  /**
   * Stateful evaluate called every frame with the node's current accumulated
   * state.
   *
   * @param inputs - Resolved input port values from upstream nodes.
   * @param ctx - Current frame's execution context.
   * @param state - The frame state produced by the previous frame's evaluation
   *   (or `initState()` on the first frame).
   * @returns Output port values. Include `__nextFrameState` in the returned
   *   object to update the state for the next frame; omit it to leave state
   *   unchanged.
   *
   * @see {@link FrameState}
   */
  evaluate(inputs: PortValues, ctx: ExecutionContext, state: FrameState): PortValues
}

/**
 * A node that samples a texture, lookup table, or other data resource.
 *
 * Sampler nodes are pure functions like Transform nodes — they receive inputs
 * and produce outputs with no side effects or state. They are a separate type
 * so the renderer can identify GPU resource dependencies at shader compilation
 * time.
 *
 * @remarks
 * Sampler nodes are subject to the same dirty-flagging rules as Transform
 * nodes. The renderer is responsible for binding the appropriate GPU texture
 * before the frame runs.
 *
 * @see {@link NodeDefinition}
 * @see {@link BaseNodeDefinition}
 */
export interface SamplerNodeDefinition extends BaseNodeDefinition {
  type: 'sampler'
}

/**
 * A node that implements conditional branching or selection logic.
 *
 * Logic nodes are pure functions like Transform nodes. They are typed
 * separately so the builder can render them with distinct UI styling and so
 * future compiler passes can identify branch points in the graph.
 *
 * @example
 * ```ts
 * const selectNode: LogicNodeDefinition = {
 *   id: 'logic/select',
 *   type: 'logic',
 *   label: 'Select',
 *   inputs: [
 *     { name: 'condition', type: 'boolean', default: false },
 *     { name: 'ifTrue',    type: 'float',   default: 1 },
 *     { name: 'ifFalse',   type: 'float',   default: 0 },
 *   ],
 *   outputs: [{ name: 'result', type: 'float' }],
 *   evaluate({ condition, ifTrue, ifFalse }) {
 *     return { result: condition ? ifTrue : ifFalse }
 *   },
 * }
 * ```
 *
 * @see {@link NodeDefinition}
 * @see {@link BaseNodeDefinition}
 */
export interface LogicNodeDefinition extends BaseNodeDefinition {
  type: 'logic'
}

/**
 * A node that encapsulates a nested sub-graph as a reusable component.
 *
 * Group nodes appear as a single node in the parent graph but contain their
 * own `GraphConfig` internally. The builder can expand or collapse them.
 * Their `evaluate` is responsible for running the subgraph.
 *
 * @remarks
 * Group node evaluation is not yet implemented by `DagRunner` — the runtime
 * currently flattens all graphs before evaluation. This type is reserved for
 * the future nested-graph feature.
 *
 * @see {@link GraphConfig}
 * @see {@link NodeDefinition}
 */
export interface GroupNodeDefinition extends BaseNodeDefinition {
  type: 'group'
  /**
   * The nested graph encapsulated by this group. The subgraph's nodes and
   * edges are hidden from the parent graph; the group's `inputs` and `outputs`
   * expose the subgraph's boundary ports.
   *
   * @see {@link GraphConfig}
   */
  subgraph: GraphConfig
}

/**
 * The terminal node of a graph — collects final values for the renderer.
 *
 * Every valid graph must contain exactly one Output node. It receives the
 * final computed colour (and any other render uniforms) from upstream nodes
 * and exposes them to the renderer via `DagRunner.getOutputs`.
 *
 * @remarks
 * `outputs` must be the empty tuple `[]`. The TypeScript type system enforces
 * this. Output nodes have no downstream consumers — their `evaluate` return
 * value is accessed by the renderer via `DagRunner.getOutputs(outputNodeId)`.
 *
 * @example
 * ```ts
 * const outputNode: OutputNodeDefinition = {
 *   id: 'output/standard',
 *   type: 'output',
 *   label: 'Output',
 *   inputs: [{ name: 'color', type: 'vec3' }],
 *   outputs: [],
 *   evaluate({ color }) {
 *     return { color }  // pass through for renderer to consume
 *   },
 * }
 * ```
 *
 * @see {@link DagRunner.getOutputs}
 * @see {@link NodeDefinition}
 */
export interface OutputNodeDefinition extends BaseNodeDefinition {
  type: 'output'
  /**
   * Always the empty tuple. Output nodes have no downstream consumers.
   * The renderer reads their values via `DagRunner.getOutputs`.
   */
  outputs: []
}

/**
 * Discriminated union of all seven node types.
 *
 * Use `NodeDefinition` wherever code accepts any node type. The `type` field
 * is the discriminant — narrowing on it gives you the concrete subtype with
 * its specific additional properties.
 *
 * @remarks
 * Adding a new node type requires:
 * 1. A new interface extending `BaseNodeDefinition` (or `Omit<...>` if
 *    the `evaluate` signature differs).
 * 2. Adding it to this union.
 * 3. A corresponding case in `DagRunner.evaluate`'s dispatch logic.
 *
 * @example
 * ```ts
 * function describeNode(def: NodeDefinition): string {
 *   switch (def.type) {
 *     case 'source':    return `Source: reads from ExecutionContext`
 *     case 'buffer':    return `Buffer: accumulates state across frames`
 *     case 'transform': return `Transform: pure function of inputs`
 *     // ...
 *   }
 * }
 * ```
 *
 * @see {@link TransformNodeDefinition}
 * @see {@link SourceNodeDefinition}
 * @see {@link BufferNodeDefinition}
 * @see {@link SamplerNodeDefinition}
 * @see {@link LogicNodeDefinition}
 * @see {@link GroupNodeDefinition}
 * @see {@link OutputNodeDefinition}
 */
export type NodeDefinition =
  | TransformNodeDefinition
  | SourceNodeDefinition
  | BufferNodeDefinition
  | SamplerNodeDefinition
  | LogicNodeDefinition
  | GroupNodeDefinition
  | OutputNodeDefinition

/**
 * The string literal union of all valid node type discriminants.
 *
 * Derived from `NodeDefinition` so it stays in sync automatically when new
 * node types are added to the union.
 *
 * @example
 * ```ts
 * function isAlwaysEvaluated(type: NodeType): boolean {
 *   return type === 'source' || type === 'buffer'
 * }
 * ```
 *
 * @see {@link NodeDefinition}
 */
export type NodeType = NodeDefinition['type']

/**
 * Opaque per-frame state object owned exclusively by Buffer nodes.
 *
 * `FrameState` is a plain key-value map. Its shape is defined by the Buffer
 * node's `initState()` return value and may be updated each frame via the
 * `__nextFrameState` key in `evaluate`'s return value.
 *
 * @remarks
 * `FrameState` is typed as `Record<string, unknown>` because each Buffer
 * node defines its own state shape. The Buffer node's `evaluate` function is
 * responsible for casting to its known state shape.
 *
 * The `__nextFrameState` key is an internal convention between `DagRunner`
 * and Buffer node authors. It must not appear in the node's declared `outputs`
 * schema — it is stripped from the output cache after being read.
 *
 * @see {@link BufferNodeDefinition}
 */
export type FrameState = Record<string, unknown>

// ---------------------------------------------------------------------------
// Graph config — the serialised user graph
// ---------------------------------------------------------------------------

/**
 * A two-dimensional position used to record where a node is placed on the
 * builder canvas.
 *
 * `Vec2` is consumed only by the builder UI; the runtime ignores `position`
 * entirely. It is included in `GraphConfig` so that a config round-trips
 * through export/import without losing visual layout.
 *
 * @see {@link GraphNode}
 */
export interface Vec2 {
  /** Horizontal position in canvas pixels, measured from the left edge. */
  x: number
  /** Vertical position in canvas pixels, measured from the top edge. */
  y: number
}

/**
 * A single placed instance of a node definition within a graph.
 *
 * `GraphNode` is the serialised representation of a node on the canvas. It
 * references a `NodeDefinition` by `definitionId` — the definition itself is
 * looked up from `NodeRegistry` at runtime.
 *
 * @remarks
 * `instanceId` must be unique within the graph but is otherwise arbitrary.
 * The builder typically generates UUIDs. The runtime makes no assumptions
 * about the format.
 *
 * Multiple `GraphNode` entries can reference the same `definitionId` — each
 * instance maintains its own dirty flag, output cache, and (for Buffer nodes)
 * frame state.
 *
 * @example
 * ```ts
 * const node: GraphNode = {
 *   instanceId: 'noise-1',
 *   definitionId: 'noise/fbm',
 *   position: { x: 200, y: 150 },
 * }
 * ```
 *
 * @see {@link GraphConfig}
 * @see {@link NodeDefinition}
 * @see {@link NodeRegistry}
 */
export interface GraphNode {
  /**
   * Unique identifier for this instance within the graph.
   * Referenced by `GraphEdge.fromInstanceId` and `GraphEdge.toInstanceId`.
   */
  instanceId: string
  /**
   * References the `NodeDefinition.id` of the node type to instantiate.
   * `NodeRegistry.get(definitionId)` must succeed at runtime or
   * `UnknownNodeError` is thrown.
   */
  definitionId: string
  /**
   * Visual position on the builder canvas. Ignored by the runtime.
   *
   * @see {@link Vec2}
   */
  position: Vec2
}

/**
 * A directed connection from one node's output port to another node's input
 * port.
 *
 * Each `GraphEdge` carries a single value per frame: the value produced by the
 * `fromPort` output of the `fromInstanceId` node is delivered to the `toPort`
 * input of the `toInstanceId` node.
 *
 * @remarks
 * Edges must not form cycles — `buildEvaluationOrder` throws `CyclicGraphError`
 * if any cycle is detected. An input port may receive at most one edge;
 * connecting a second edge to the same input port is invalid and the builder
 * must prevent it.
 *
 * @example
 * ```ts
 * const edge: GraphEdge = {
 *   fromInstanceId: 'noise-1',
 *   fromPort: 'value',
 *   toInstanceId: 'remap-1',
 *   toPort: 'input',
 * }
 * ```
 *
 * @see {@link GraphConfig}
 * @see {@link buildEvaluationOrder}
 */
export interface GraphEdge {
  /** `instanceId` of the upstream node producing the value. */
  fromInstanceId: string
  /** Output port name on the upstream node. Must match an entry in its `outputs` schema. */
  fromPort: string
  /** `instanceId` of the downstream node consuming the value. */
  toInstanceId: string
  /** Input port name on the downstream node. Must match an entry in its `inputs` schema. */
  toPort: string
}

/**
 * The complete serialised graph — produced by the builder, consumed by
 * `createBackground`.
 *
 * `GraphConfig` is the contract between the visual builder and the runtime.
 * Persisting this object (e.g. as a JSON file) is sufficient to recreate the
 * exact same animated background on any page.
 *
 * @remarks
 * **Versioning:** The `version` field is a literal `1`. Future breaking changes
 * to the format will increment this number so that runtimes can detect
 * incompatible configs and reject them with a helpful error.
 *
 * **Tree-shaking:** Bundlers can tree-shake unused node definitions from
 * `@funny-colors/nodes` because the runtime resolves `definitionId` strings
 * through `NodeRegistry` at startup — only the definitions actually passed to
 * `NodeRegistry` are included in the bundle.
 *
 * @example
 * ```ts
 * const config: GraphConfig = {
 *   version: 1,
 *   nodes: [
 *     { instanceId: 'time-1',   definitionId: 'source/time',   position: { x: 0,   y: 0 } },
 *     { instanceId: 'noise-1',  definitionId: 'noise/fbm',     position: { x: 200, y: 0 } },
 *     { instanceId: 'output-1', definitionId: 'output/standard', position: { x: 400, y: 0 } },
 *   ],
 *   edges: [
 *     { fromInstanceId: 'time-1',  fromPort: 'time',  toInstanceId: 'noise-1',  toPort: 'seed' },
 *     { fromInstanceId: 'noise-1', fromPort: 'value', toInstanceId: 'output-1', toPort: 'color' },
 *   ],
 *   params: { speed: 1.0 },
 * }
 * ```
 *
 * @see {@link GraphNode}
 * @see {@link GraphEdge}
 * @see {@link buildEvaluationOrder}
 * @see {@link DagRunner}
 */
export interface GraphConfig {
  /**
   * Schema version. Currently always `1`. A future breaking change to the
   * `GraphConfig` format will increment this literal so that consumers can
   * reject incompatible configs before attempting to parse them.
   */
  version: 1
  /** All node instances placed in the graph. Order is irrelevant — the runtime sorts them. */
  nodes: GraphNode[]
  /** All directed connections between node ports. */
  edges: GraphEdge[]
  /**
   * Named runtime parameters exposed to the host page via
   * `BackgroundInstance.setParam`. The values here are the initial defaults;
   * the host may override them at any time after construction.
   *
   * @see {@link BackgroundInstance.setParam}
   * @see {@link ParamStore}
   */
  params: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Graph editor adapter
// ---------------------------------------------------------------------------

/**
 * An `instanceId` + port name pair that identifies one end of a connection.
 *
 * Used as the argument type for `GraphEditorAdapter.onConnect` callbacks so
 * the builder can create a new `GraphEdge` when the user draws a connection
 * between two ports.
 *
 * @see {@link GraphEditorAdapter}
 * @see {@link GraphEdge}
 */
export interface PortRef {
  /** The `instanceId` of the node that owns this port. */
  instanceId: string
  /** The port name (matches a `name` in the node's `inputs` or `outputs` schema). */
  port: string
}

/**
 * Abstraction layer over the node graph canvas library used by `apps/web`.
 *
 * The web builder currently uses xyflow (`@xyflow/system`) to render the
 * interactive canvas. `GraphEditorAdapter` isolates all xyflow-specific code
 * inside `apps/web/src/adapters/xyflow-adapter.ts`. The rest of the builder
 * depends only on this interface — swapping the underlying library requires
 * changing only that one file.
 *
 * @remarks
 * This interface lives in `@funny-colors/core` (not in `apps/web`) so that
 * the type contract is independently versionable and importable by any future
 * alternative adapter without taking a dependency on the web app.
 *
 * @example
 * ```ts
 * // apps/web/src/adapters/xyflow-adapter.ts
 * export class XyflowAdapter implements GraphEditorAdapter {
 *   mount(container: HTMLElement) { ... }
 *   // ...
 * }
 * ```
 *
 * @see {@link PortRef}
 * @see {@link GraphNode}
 * @see {@link GraphEdge}
 */
export interface GraphEditorAdapter {
  /**
   * Mounts the graph canvas into the given DOM container and starts rendering.
   * Must be called before any other method.
   *
   * @param container - The DOM element that will host the canvas. The adapter
   *   takes ownership of its contents.
   */
  mount(container: HTMLElement): void
  /**
   * Replaces the current set of displayed nodes with the given list.
   * Triggers a canvas re-render.
   *
   * @param nodes - The complete new node list. Diffing against the previous
   *   list (if any) is the adapter's responsibility.
   */
  setNodes(nodes: GraphNode[]): void
  /**
   * Replaces the current set of displayed edges with the given list.
   * Triggers a canvas re-render.
   *
   * @param edges - The complete new edge list.
   */
  setEdges(edges: GraphEdge[]): void
  /**
   * Registers a callback invoked when the user draws a new connection between
   * two ports on the canvas.
   *
   * @param cb - Called with the source (`from`) and destination (`to`) port
   *   references. The builder should create a `GraphEdge` from these and add
   *   it to the graph config.
   */
  onConnect(cb: (from: PortRef, to: PortRef) => void): void
  /**
   * Registers a callback invoked when the user drags a node to a new position.
   *
   * @param cb - Called with the `instanceId` of the moved node and its new
   *   canvas position. The builder should update `GraphNode.position`.
   */
  onNodeMove(cb: (instanceId: string, pos: Vec2) => void): void
  /**
   * Unmounts the canvas, removes all event listeners, and releases any
   * resources held by the adapter. Must be called when the builder is torn
   * down to prevent memory leaks.
   */
  destroy(): void
}

// ---------------------------------------------------------------------------
// Public runtime API
// ---------------------------------------------------------------------------

/**
 * The public handle returned by `createBackground(canvas, config)`.
 *
 * This is the only surface the host page interacts with after the background
 * is running. It provides param control and a teardown hook.
 *
 * @remarks
 * `createBackground` is implemented in `@funny-colors/funny-colors` (the
 * public package), not in `@funny-colors/core`. The interface lives here so
 * that it can be referenced in type documentation and tests without taking a
 * dependency on the public package.
 *
 * @example
 * ```ts
 * import { createBackground } from 'funny-colors'
 *
 * const bg: BackgroundInstance = createBackground(canvas, config)
 *
 * // Respond to user interaction:
 * speedSlider.addEventListener('input', () => {
 *   bg.setParam('speed', speedSlider.valueAsNumber)
 * })
 *
 * // Clean up when leaving the page:
 * window.addEventListener('beforeunload', () => bg.destroy())
 * ```
 *
 * @see {@link GraphConfig}
 * @see {@link ParamStore}
 */
export interface BackgroundInstance {
  /**
   * Updates a named runtime parameter and triggers re-evaluation of all
   * downstream nodes on the next animation frame.
   *
   * Calling this with a key that was not declared in `GraphConfig.params` is
   * allowed but has no visual effect — no node reads the undeclared param.
   *
   * @param name - The param key, as declared in `GraphConfig.params`.
   * @param value - The new value. Should be JSON-serialisable and compatible
   *   with the param's declared type.
   *
   * @example
   * ```ts
   * bg.setParam('speed', 2.5)
   * bg.setParam('colorA', [1, 0.2, 0.8])
   * ```
   */
  setParam(name: string, value: unknown): void
  /**
   * Stops the animation loop, cancels any pending `requestAnimationFrame`,
   * releases GPU resources held by the renderer, and removes all event
   * listeners.
   *
   * After calling `destroy`, the `BackgroundInstance` must not be used again.
   */
  destroy(): void
}
