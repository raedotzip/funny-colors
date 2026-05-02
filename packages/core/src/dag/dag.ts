/**
 * @fileoverview DAG engine for `@funny-colors/core`.
 *
 * This module provides two things:
 *
 * 1. {@link buildEvaluationOrder} — a one-time topological sort of a
 *    {@link GraphConfig} that determines the order in which nodes must be
 *    evaluated each frame. Implements Kahn's algorithm.
 *
 * 2. {@link DagRunner} — the per-frame evaluation engine. Given a sorted
 *    evaluation order and a {@link NodeRegistry}, it resolves each node's
 *    inputs from upstream outputs (or port defaults), calls `evaluate`, and
 *    caches the results for downstream nodes. Dirty flagging ensures only
 *    changed subgraphs re-evaluate.
 *
 * @see {@link buildEvaluationOrder}
 * @see {@link DagRunner}
 * @see {@link NodeRegistry}
 * @see {@link CyclicGraphError}
 *
 * @example
 * ```ts
 * import { buildEvaluationOrder, DagRunner, NodeRegistry } from '@funny-colors/core'
 *
 * const order = buildEvaluationOrder(config)        // throws CyclicGraphError on cycle
 * const runner = new DagRunner(config, registry)
 *
 * // Each animation frame:
 * runner.evaluate(ctx)
 * const uniforms = runner.getOutputs('output-node-id')
 * ```
 *
 * @module
 */

import type {
  GraphConfig,
  GraphEdge,
  PortValues,
  ExecutionContext,
  BufferNodeDefinition,
  FrameState,
} from '../types'
import type { NodeRegistry } from '../registry'
import { CyclicGraphError } from '../errors'

// ---------------------------------------------------------------------------
// buildEvaluationOrder
// ---------------------------------------------------------------------------

/**
 * Performs a topological sort of `config` using Kahn's algorithm and returns
 * an ordered list of `instanceId` strings.
 *
 * Nodes with no upstream dependencies appear first. The Output node appears
 * last. The returned order is stable across calls for the same config.
 *
 * @remarks
 * This function must be called once at startup before constructing a
 * {@link DagRunner}. It does not need to be called again unless the graph
 * structure changes (e.g. an edge is added or removed in the builder).
 *
 * @param config - The graph to sort.
 * @returns An ordered array of `instanceId` strings, upstream → downstream.
 * @throws {CyclicGraphError} When the graph contains a directed cycle and
 *   therefore cannot be topologically ordered.
 *
 * @example
 * ```ts
 * const order = buildEvaluationOrder(config)
 * // ['time-source-1', 'noise-1', 'output-1']
 * ```
 */
export function buildEvaluationOrder(config: GraphConfig): string[] {
  // Build adjacency list (downstream edges) and in-degree map.
  const inDegree = new Map<string, number>()
  const downstream = new Map<string, string[]>()

  for (const node of config.nodes) {
    inDegree.set(node.instanceId, 0)
    downstream.set(node.instanceId, [])
  }

  for (const edge of config.edges) {
    const to = edge.toInstanceId
    // inDegree and downstream are pre-seeded for every declared node above.
    inDegree.set(to, inDegree.get(to)! + 1)
    downstream.get(edge.fromInstanceId)!.push(to)
  }

  // Kahn's algorithm: start with all nodes that have no incoming edges.
  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  const order: string[] = []
  while (queue.length > 0) {
    // Non-null assertion is safe: we only enter the loop when queue is non-empty.
    const id = queue.shift()!
    order.push(id)
    for (const downId of downstream.get(id)!) {
      const newDeg = inDegree.get(downId)! - 1
      inDegree.set(downId, newDeg)
      if (newDeg === 0) queue.push(downId)
    }
  }

  if (order.length !== config.nodes.length) {
    throw new CyclicGraphError()
  }

  return order
}

// ---------------------------------------------------------------------------
// DagRunner
// ---------------------------------------------------------------------------

/**
 * Evaluates a node graph each frame, caching outputs and skipping clean nodes.
 *
 * Construction is cheap — do it once at `createBackground` startup. Call
 * {@link evaluate} on every `requestAnimationFrame` tick. Use
 * {@link markDirty} to invalidate a node and all its descendants when
 * upstream data changes (e.g. via `setParam`).
 *
 * @remarks
 * **Dirty flagging rules:**
 * - All nodes start dirty on construction.
 * - After a node is evaluated it is marked clean.
 * - Source nodes are always treated as dirty — they re-evaluate every frame
 *   because their data comes from `ExecutionContext`, which changes each frame.
 * - Calling {@link markDirty} on a node propagates the dirty flag to all
 *   transitive descendants via BFS over the edge list.
 *
 * **Buffer nodes:**
 * - `initState()` is called once at construction and the result stored.
 * - Each frame the stored state is passed as the third argument to `evaluate`.
 * - Whatever the node returns under `__nextFrameState` becomes the state for
 *   the following frame.
 *
 * @example
 * ```ts
 * const runner = new DagRunner(config, registry)
 *
 * // Wire param changes to dirty flagging:
 * paramStore.onChange((name) => {
 *   const paramNodeId = findParamNodeId(config, name)
 *   if (paramNodeId) runner.markDirty(paramNodeId)
 * })
 *
 * function frame(time: number) {
 *   runner.evaluate({ time, mouse, audio, canvas, params: paramStore.snapshot() })
 *   const uniforms = runner.getOutputs(outputNodeId)
 *   renderer.render(uniforms)
 *   requestAnimationFrame(frame)
 * }
 * ```
 */
export class DagRunner {
  readonly #config: GraphConfig
  readonly #registry: NodeRegistry
  readonly #order: string[]

  /** Per-node output cache. Populated by {@link evaluate}. */
  readonly #outputs: Map<string, PortValues>

  /** Per-node dirty flag. True = must re-evaluate. */
  readonly #dirty: Map<string, boolean>

  /** Per-buffer-node frame state, keyed by instanceId. */
  readonly #bufferState: Map<string, FrameState>

  /**
   * Pre-computed map: for each node, which nodes does it feed into (downstream).
   * Used by {@link markDirty} to propagate the dirty flag.
   */
  readonly #downstream: Map<string, string[]>

  /**
   * Pre-computed map: for each `toInstanceId+toPort`, which `fromInstanceId`
   * and `fromPort` is connected. Used to resolve input values during evaluation.
   */
  readonly #incomingEdge: Map<string, GraphEdge>

  /**
   * @param config - The validated graph config to evaluate.
   * @param registry - Registry containing all node definitions referenced by `config`.
   */
  constructor(config: GraphConfig, registry: NodeRegistry) {
    this.#config = config
    this.#registry = registry
    this.#order = buildEvaluationOrder(config)
    this.#outputs = new Map()
    this.#dirty = new Map()
    this.#bufferState = new Map()

    // Build downstream adjacency and incoming-edge lookup.
    this.#downstream = new Map(config.nodes.map((n) => [n.instanceId, []]))
    this.#incomingEdge = new Map()

    for (const edge of config.edges) {
      this.#downstream.get(edge.fromInstanceId)?.push(edge.toInstanceId)
      this.#incomingEdge.set(`${edge.toInstanceId}:${edge.toPort}`, edge)
    }

    // All nodes start dirty and with empty cached outputs.
    for (const node of config.nodes) {
      this.#dirty.set(node.instanceId, true)
      this.#outputs.set(node.instanceId, {})

      // Initialise buffer state once.
      const def = registry.get(node.definitionId)
      if (def.type === 'buffer') {
        this.#bufferState.set(node.instanceId, (def as BufferNodeDefinition).initState())
      }
    }
  }

  /**
   * Evaluates every dirty node in topological order and updates the output
   * cache. Source nodes always re-evaluate; all other node types are skipped
   * when clean.
   *
   * @param ctx - The current frame's execution context (time, mouse, audio,
   *   canvas dimensions, and runtime params).
   *
   * @example
   * ```ts
   * runner.evaluate({
   *   time: elapsed,
   *   mouse: [mx, my],
   *   audio: analyserData,
   *   canvas: { width: gl.drawingBufferWidth, height: gl.drawingBufferHeight },
   *   params: paramStore.snapshot(),
   * })
   * ```
   */
  evaluate(ctx: ExecutionContext): void {
    for (const instanceId of this.#order) {
      const graphNode = this.#config.nodes.find((n) => n.instanceId === instanceId)!
      const def = this.#registry.get(graphNode.definitionId)
      const isSource = def.type === 'source'
      // Buffer nodes are also stateful — their accumulated state changes every
      // frame they run, so they must always re-evaluate like source nodes.
      const isBuffer = def.type === 'buffer'
      const alwaysEvaluate = isSource || isBuffer

      if (!alwaysEvaluate && !this.#dirty.get(instanceId)) continue

      // Resolve inputs: upstream output overrides port default.
      const inputs: PortValues = {}
      if (!isSource) {
        for (const port of def.inputs) {
          const edgeKey = `${instanceId}:${port.name}`
          const edge = this.#incomingEdge.get(edgeKey)
          if (edge !== undefined) {
            // #outputs is pre-seeded for every declared node in the constructor.
            const upstreamOutputs = this.#outputs.get(edge.fromInstanceId)!
            inputs[port.name] = upstreamOutputs[edge.fromPort]
          } else {
            inputs[port.name] = port.default
          }
        }
      }

      // Dispatch by node type.
      let result: PortValues
      if (def.type === 'buffer') {
        // #bufferState is seeded for every buffer node in the constructor.
        const state = this.#bufferState.get(instanceId)!
        result = def.evaluate(inputs, ctx, state)
        if ('__nextFrameState' in result) {
          this.#bufferState.set(instanceId, result['__nextFrameState'] as FrameState)
        }
      } else {
        result = def.evaluate(inputs, ctx)
      }

      this.#outputs.set(instanceId, result)
      this.#dirty.set(instanceId, false)
    }
  }

  /**
   * Returns the cached output values for a node from the most recent
   * {@link evaluate} call.
   *
   * Returns an empty object if the node has never been evaluated (e.g. on the
   * first frame before `evaluate` runs, or for a clean node that was skipped).
   *
   * @param instanceId - The node instance to query.
   * @returns The node's output {@link PortValues} map.
   *
   * @example
   * ```ts
   * runner.evaluate(ctx)
   * const { color } = runner.getOutputs('output-1')
   * renderer.render({ color })
   * ```
   */
  getOutputs(instanceId: string): PortValues {
    return this.#outputs.get(instanceId) ?? {}
  }

  /**
   * Marks a node and all of its transitive descendants dirty so they
   * re-evaluate on the next {@link evaluate} call.
   *
   * Uses breadth-first search over the downstream edge list built at
   * construction. Calling this multiple times for the same node before the
   * next frame is idempotent.
   *
   * Typically called by the param store's `onChange` listener when
   * `BackgroundInstance.setParam()` is invoked.
   *
   * @param instanceId - The node to start dirtying from (inclusive).
   *
   * @example
   * ```ts
   * paramStore.onChange((name) => {
   *   const nodeId = findParamNodeForName(config, name)
   *   if (nodeId) runner.markDirty(nodeId)
   * })
   * ```
   */
  markDirty(instanceId: string): void {
    const queue = [instanceId]
    while (queue.length > 0) {
      const id = queue.shift()!
      this.#dirty.set(id, true)
      for (const downId of this.#downstream.get(id) ?? []) {
        if (!this.#dirty.get(downId)) {
          queue.push(downId)
        }
      }
    }
  }
}
