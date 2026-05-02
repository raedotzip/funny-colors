/**
 * @fileoverview Named error classes for `@funny-colors/core`.
 *
 * All errors follow the standard established in ADR-015:
 * - Extend `Error` with an explicit `name` (survives minification)
 * - Carry a stable `code` string for machine consumers
 * - Include context fields relevant to the failure
 *
 * Every error is exported from the package root so callers can import and
 * narrow with `instanceof` or by comparing `.code`.
 *
 * @example
 * ```ts
 * import { CyclicGraphError, UnknownNodeError } from '@funny-colors/core'
 *
 * try {
 *   buildEvaluationOrder(config)
 * } catch (e) {
 *   if (e instanceof CyclicGraphError) {
 *     console.error('Fix the cycle in your graph before rendering.')
 *   }
 * }
 * ```
 *
 * @module
 */

// ---------------------------------------------------------------------------
// CyclicGraphError
// ---------------------------------------------------------------------------

/**
 * Thrown by {@link buildEvaluationOrder} when the node graph contains a
 * directed cycle and therefore cannot be topologically sorted.
 *
 * A valid graph is a DAG (directed acyclic graph). If node A's output feeds
 * into node B, then B must not (directly or transitively) feed back into A.
 *
 * @example
 * ```ts
 * import { buildEvaluationOrder, CyclicGraphError } from '@funny-colors/core'
 *
 * try {
 *   buildEvaluationOrder(config)
 * } catch (e) {
 *   if (e instanceof CyclicGraphError) {
 *     // Show the user which nodes form the cycle
 *   }
 * }
 * ```
 */
export class CyclicGraphError extends Error {
  /** Stable machine-readable code. Never changes across patch/minor versions. */
  readonly code = 'CYCLIC_GRAPH' as const

  constructor() {
    super(
      'The node graph contains a directed cycle and cannot be evaluated. ' +
        'Ensure every edge points from upstream nodes to downstream nodes with no feedback loops.',
    )
    this.name = 'CyclicGraphError'
  }
}

// ---------------------------------------------------------------------------
// UnknownNodeError
// ---------------------------------------------------------------------------

/**
 * Thrown by {@link NodeRegistry.get} — and transitively by the DAG runner at
 * startup — when a {@link GraphNode} references a `definitionId` that has no
 * corresponding registered {@link NodeDefinition}.
 *
 * This is always a programmer error: either the node type is misspelled, the
 * plugin that provides it was not passed to `createBackground`, or the graph
 * was serialised against a different version of the library.
 *
 * @example
 * ```ts
 * import { UnknownNodeError } from '@funny-colors/core'
 *
 * try {
 *   const bg = createBackground(canvas, config)
 * } catch (e) {
 *   if (e instanceof UnknownNodeError) {
 *     console.error(`Missing node plugin for: ${e.definitionId}`)
 *   }
 * }
 * ```
 */
export class UnknownNodeError extends Error {
  /** Stable machine-readable code. Never changes across patch/minor versions. */
  readonly code = 'UNKNOWN_NODE' as const

  /**
   * The `definitionId` that was not found in the registry.
   * Use this to tell the user exactly which node type is missing.
   */
  readonly definitionId: string

  /**
   * @param definitionId - The `definitionId` string that was not found.
   */
  constructor(definitionId: string) {
    super(
      `No node definition is registered for id: "${definitionId}". ` +
        'Ensure the node type is built-in or that the plugin providing it is passed via options.plugins.',
    )
    this.name = 'UnknownNodeError'
    this.definitionId = definitionId
  }
}
