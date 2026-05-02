/**
 * @fileoverview Re-exports the {@link ParamStore} class.
 *
 * `ParamStore` holds the named runtime parameter values declared in
 * `GraphConfig.params`. The host page writes to it via
 * `BackgroundInstance.setParam()`; `DagRunner` reads a snapshot into
 * `ExecutionContext.params` each frame. Change listeners enable selective
 * dirty-flagging so only the affected subgraph re-evaluates on param change.
 *
 * @see {@link ParamStore}
 * @see {@link GraphConfig}
 * @see {@link ExecutionContext}
 * @see {@link BackgroundInstance}
 *
 * @module
 */

export * from './param-store'
