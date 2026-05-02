// All public interfaces for the funny-colors type system.
// The node taxonomy, port contracts, and execution context live here.
// Every other package imports from here — never the reverse.

/** Scalar and vector value types that can flow through node ports. */
export type PortValueType =
  | 'float'
  | 'vec2'
  | 'vec3'
  | 'vec4'
  | 'color'
  | 'boolean'
  | 'int'

/** Declares a single input or output port on a node. */
export interface PortSchema {
  name: string
  type: PortValueType
  /** Default value used when no upstream connection exists. */
  default?: unknown
}

/** A map of port names to their resolved runtime values. */
export type PortValues = Record<string, unknown>

/** Runtime context injected into Source nodes each frame. */
export interface ExecutionContext {
  /** Elapsed time in seconds since the background started. */
  time: number
  /** Normalised mouse position [0,1] relative to the canvas. */
  mouse: [number, number]
  /** Current audio frequency data, or null if no audio source. */
  audio: Float32Array | null
  /** Current canvas dimensions in pixels. */
  canvas: { width: number; height: number }
  /** Named runtime params set via `background.setParam()`. */
  params: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Node type interfaces (discriminated union)
// ---------------------------------------------------------------------------

interface BaseNodeDefinition {
  /** Unique stable identifier for this node type (e.g. "noise/fbm"). */
  id: string
  type: NodeType
  /** Human-readable label shown in the builder UI. */
  label: string
  inputs: PortSchema[]
  outputs: PortSchema[]
  /**
   * Pure function evaluated each frame.
   * Source nodes receive an empty `inputs` map; their data comes from `ctx`.
   */
  evaluate(inputs: PortValues, ctx: ExecutionContext): PortValues
}

export interface TransformNodeDefinition extends BaseNodeDefinition {
  type: 'transform'
}

export interface SourceNodeDefinition extends BaseNodeDefinition {
  type: 'source'
  /** Source nodes declare no upstream inputs — all data comes from ctx. */
  inputs: []
}

export interface BufferNodeDefinition extends BaseNodeDefinition {
  type: 'buffer'
  /** Returns the initial per-instance frame state. */
  initState(): FrameState
}

export interface SamplerNodeDefinition extends BaseNodeDefinition {
  type: 'sampler'
}

export interface LogicNodeDefinition extends BaseNodeDefinition {
  type: 'logic'
}

export interface GroupNodeDefinition extends BaseNodeDefinition {
  type: 'group'
  /** The subgraph encapsulated by this group. */
  subgraph: GraphConfig
}

export interface OutputNodeDefinition extends BaseNodeDefinition {
  type: 'output'
  /** Output nodes declare no downstream outputs. */
  outputs: []
}

export type NodeDefinition =
  | TransformNodeDefinition
  | SourceNodeDefinition
  | BufferNodeDefinition
  | SamplerNodeDefinition
  | LogicNodeDefinition
  | GroupNodeDefinition
  | OutputNodeDefinition

export type NodeType = NodeDefinition['type']

/** Opaque per-frame state object owned by Buffer nodes. */
export type FrameState = Record<string, unknown>

// ---------------------------------------------------------------------------
// Graph config — the serialised user graph (exported from the builder)
// ---------------------------------------------------------------------------

export interface Vec2 {
  x: number
  y: number
}

/** A node instance placed in the graph. */
export interface GraphNode {
  /** Unique instance ID within this graph. */
  instanceId: string
  /** References a registered NodeDefinition.id. */
  definitionId: string
  position: Vec2
}

/** A connection between two node ports. */
export interface GraphEdge {
  fromInstanceId: string
  fromPort: string
  toInstanceId: string
  toPort: string
}

/** The full serialised graph config — produced by the builder, consumed by the runtime. */
export interface GraphConfig {
  version: 1
  nodes: GraphNode[]
  edges: GraphEdge[]
  /** Named runtime params exposed to the host page. */
  params: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Graph editor adapter — abstracts xyflow (or any future replacement)
// ---------------------------------------------------------------------------

export interface PortRef {
  instanceId: string
  port: string
}

/** Implemented by the xyflow adapter in apps/web. Depend on this, not xyflow. */
export interface GraphEditorAdapter {
  mount(container: HTMLElement): void
  setNodes(nodes: GraphNode[]): void
  setEdges(edges: GraphEdge[]): void
  onConnect(cb: (from: PortRef, to: PortRef) => void): void
  onNodeMove(cb: (instanceId: string, pos: Vec2) => void): void
  destroy(): void
}

// ---------------------------------------------------------------------------
// Public runtime API — returned by createBackground()
// ---------------------------------------------------------------------------

export interface BackgroundInstance {
  setParam(name: string, value: unknown): void
  destroy(): void
}
