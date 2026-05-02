/**
 * @fileoverview Re-exports all error classes from `@funny-colors/core`.
 *
 * All errors follow the standard in ADR-015: named `Error` subclasses with a
 * stable `code` string for machine consumers and an explicit `name` property
 * that survives minification.
 *
 * @see {@link CyclicGraphError} — thrown by `buildEvaluationOrder` on a cycle
 * @see {@link UnknownNodeError} — thrown by `NodeRegistry.get` for a missing id
 *
 * @module
 */

export * from './errors'
