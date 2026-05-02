/**
 * @fileoverview Public entry point for `@funny-colors/core`.
 *
 * Re-exports every public symbol from all submodules. Import from this
 * module rather than from individual submodule paths so that internal
 * restructuring never breaks consumer import paths.
 *
 * @example
 * ```ts
 * import {
 *   NodeRegistry,
 *   ParamStore,
 *   buildEvaluationOrder,
 *   DagRunner,
 *   CyclicGraphError,
 *   UnknownNodeError,
 * } from '@funny-colors/core'
 * ```
 *
 * @module
 */

export * from './types'
export * from './errors'
export * from './registry'
export * from './param-store'
export * from './dag'
