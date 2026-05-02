/**
 * @fileoverview Re-exports all public type contracts for `@funny-colors/core`.
 *
 * This module contains every interface, type alias, and enum used across the
 * entire funny-colors system. All other packages depend on these contracts;
 * none of them depend on each other.
 *
 * @see {@link NodeDefinition} — discriminated union of all 7 node types
 * @see {@link GraphConfig} — serialised graph produced by the builder
 * @see {@link ExecutionContext} — per-frame data injected into Source nodes
 * @see {@link BackgroundInstance} — public runtime API returned by `createBackground`
 *
 * @module
 */

export * from './types'
