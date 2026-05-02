/**
 * @fileoverview Re-exports the {@link NodeRegistry} class.
 *
 * `NodeRegistry` is the single source of truth for which node types are
 * available in a given `createBackground` call. It is built once at startup
 * from built-in nodes plus any third-party plugins, then consumed read-only
 * by `DagRunner` during frame evaluation.
 *
 * @see {@link NodeRegistry}
 * @see {@link NodeDefinition}
 * @see {@link UnknownNodeError}
 *
 * @module
 */

export * from './registry'
