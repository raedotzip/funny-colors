/**
 * @fileoverview Node definition registry for `@funny-colors/core`.
 *
 * The {@link NodeRegistry} maps `definitionId` strings to their
 * {@link NodeDefinition} objects. It is populated at startup with the
 * built-in nodes from `@funny-colors/nodes` and any third-party plugins
 * passed via `createBackground(canvas, config, { plugins })`.
 *
 * @example
 * ```ts
 * import { NodeRegistry } from '@funny-colors/core'
 * import { TimeNode, NoiseNode } from '@funny-colors/nodes'
 *
 * const registry = new NodeRegistry([TimeNode, NoiseNode])
 * const def = registry.get('source/time') // → TimeNode definition
 * ```
 *
 * @module
 */

import type { NodeDefinition } from '../types'
import { UnknownNodeError } from '../errors'

/**
 * Maps `definitionId` strings to their {@link NodeDefinition} objects.
 *
 * Built at startup; read-only during frame evaluation. The registry is
 * the single source of truth for which node types are available in a
 * given `createBackground` call.
 *
 * @see {@link NodeDefinition}
 * @see {@link UnknownNodeError}
 *
 * @example
 * ```ts
 * const registry = new NodeRegistry([TimeNode, NoiseNode])
 * registry.register(MyPluginNode)
 * const def = registry.get('source/time')
 * ```
 */
export class NodeRegistry {
  readonly #map: Map<string, NodeDefinition>

  /**
   * @param definitions - Initial set of node definitions to register. Later
   *   calls to {@link register} can add more. Construction order does not
   *   affect lookup — the last registration for a given id wins.
   */
  constructor(definitions: NodeDefinition[]) {
    this.#map = new Map(definitions.map((d) => [d.id, d]))
  }

  /**
   * Returns the {@link NodeDefinition} for the given `id`.
   *
   * @param id - The `definitionId` to look up (e.g. `"source/time"`).
   * @returns The registered node definition.
   * @throws {UnknownNodeError} When no definition has been registered for `id`.
   *
   * @example
   * ```ts
   * const def = registry.get('source/time')
   * const outputs = def.evaluate({}, ctx)
   * ```
   */
  get(id: string): NodeDefinition {
    const def = this.#map.get(id)
    if (def === undefined) {
      throw new UnknownNodeError(id)
    }
    return def
  }

  /**
   * Returns `true` if a definition is registered for `id`, `false` otherwise.
   *
   * Prefer this over wrapping {@link get} in a try/catch when you only need
   * to check existence.
   *
   * @param id - The `definitionId` to test.
   *
   * @example
   * ```ts
   * if (!registry.has(node.definitionId)) {
   *   throw new UnknownNodeError(node.definitionId)
   * }
   * ```
   */
  has(id: string): boolean {
    return this.#map.has(id)
  }

  /**
   * Registers an additional node definition. If a definition with the same
   * `id` already exists, it is replaced (last registration wins).
   *
   * Intended for registering third-party plugins after initial construction.
   *
   * @param definition - The node definition to register.
   *
   * @example
   * ```ts
   * registry.register(WobbleNode)
   * ```
   */
  register(definition: NodeDefinition): void {
    this.#map.set(definition.id, definition)
  }
}
