/**
 * @fileoverview Re-exports the DAG engine: {@link buildEvaluationOrder} and {@link DagRunner}.
 *
 * These two exports together implement the full frame evaluation pipeline:
 * `buildEvaluationOrder` converts a `GraphConfig` into a stable topological
 * ordering once at startup, and `DagRunner` uses that ordering to evaluate
 * only the dirty portion of the graph on every animation frame.
 *
 * @see {@link buildEvaluationOrder}
 * @see {@link DagRunner}
 * @see {@link CyclicGraphError}
 * @see {@link NodeRegistry}
 * @see {@link ExecutionContext}
 *
 * @module
 */

export * from './dag'
