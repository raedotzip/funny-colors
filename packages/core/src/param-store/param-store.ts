/**
 * @fileoverview Runtime parameter store for `@funny-colors/core`.
 *
 * The {@link ParamStore} holds the named runtime values declared in
 * {@link GraphConfig.params}. The host page writes to it via
 * `BackgroundInstance.setParam()`; {@link ParamNode} instances in the DAG
 * read from it each frame via {@link ExecutionContext.params}.
 *
 * Change listeners ({@link ParamStore.onChange}) allow the DAG runner to
 * mark only the affected subgraph dirty instead of re-evaluating every node.
 *
 * @see {@link ParamStore}
 * @see {@link GraphConfig}
 *
 * @example
 * ```ts
 * import { ParamStore } from '@funny-colors/core'
 *
 * const store = new ParamStore({ speed: 1.0, hue: 0.5 })
 *
 * store.onChange((name, value) => {
 *   dagRunner.markDirty(paramNodeIds[name])
 * })
 *
 * store.set('speed', 2.0) // triggers onChange, then dirty-flags downstream nodes
 * ```
 *
 * @module
 */

/** Callback invoked whenever a param value changes via {@link ParamStore.set}. */
type ChangeListener = (name: string, value: unknown) => void

/**
 * Holds named runtime parameter values and notifies listeners on every change.
 *
 * The store is intentionally simple: it stores any key/value pair and fires
 * listeners on every `set` call regardless of whether the value changed.
 * Deduplication (if desired) is the caller's responsibility.
 *
 * @remarks
 * Declared params come from {@link GraphConfig.params} at startup. Calling
 * `set` with an undeclared key is allowed — the value is stored and listeners
 * are notified. The DAG runner ignores params that have no corresponding
 * `ParamNode` in the graph.
 *
 * @example
 * ```ts
 * const store = new ParamStore({ speed: 1.0 })
 * const unsub = store.onChange((name, value) => console.log(name, value))
 * store.set('speed', 2.5) // logs: speed 2.5
 * unsub()                 // stop listening
 * ```
 */
export class ParamStore {
  readonly #params: Map<string, unknown>
  readonly #listeners: Set<ChangeListener>

  /**
   * @param initial - The initial param values from {@link GraphConfig.params}.
   *   All keys declared here become available via {@link get} immediately.
   */
  constructor(initial: Record<string, unknown>) {
    this.#params = new Map(Object.entries(initial))
    this.#listeners = new Set()
  }

  /**
   * Returns the current value of a named param.
   *
   * @param name - The param name as declared in {@link GraphConfig.params}.
   * @returns The stored value, or `undefined` if `name` was never declared or set.
   *
   * @example
   * ```ts
   * const speed = store.get('speed') as number
   * ```
   */
  get(name: string): unknown {
    return this.#params.get(name)
  }

  /**
   * Updates the value of a named param and fires all registered
   * {@link onChange} listeners synchronously.
   *
   * Setting an undeclared key is allowed — the key is stored and listeners
   * are notified. Callers (the DAG runner) are responsible for ignoring
   * params that have no corresponding node in the graph.
   *
   * @param name - The param name to update.
   * @param value - The new value. Any JSON-serialisable value is accepted.
   *
   * @example
   * ```ts
   * store.set('speed', 2.0)
   * store.set('colorA', [1, 0.2, 0.8])
   * ```
   */
  set(name: string, value: unknown): void {
    this.#params.set(name, value)
    for (const listener of this.#listeners) {
      listener(name, value)
    }
  }

  /**
   * Registers a listener that is called synchronously on every {@link set}.
   *
   * Multiple listeners can be registered; each is called in registration order.
   *
   * @param cb - Called with the param `name` and new `value` on every {@link set}.
   * @returns An unsubscribe function. Call it to remove this listener.
   *
   * @example
   * ```ts
   * const unsub = store.onChange((name, value) => {
   *   dagRunner.markDirty(paramNodeIds[name])
   * })
   *
   * // Later, when the BackgroundInstance is destroyed:
   * unsub()
   * ```
   */
  onChange(cb: ChangeListener): () => void {
    this.#listeners.add(cb)
    return () => {
      this.#listeners.delete(cb)
    }
  }

  /**
   * Returns a shallow copy of all current param values as a plain object.
   *
   * The returned object is a snapshot — mutating it does not affect the store.
   * Use this to populate {@link ExecutionContext.params} each frame.
   *
   * @returns A plain `Record<string, unknown>` with all param key/value pairs.
   *
   * @example
   * ```ts
   * const ctx: ExecutionContext = {
   *   time,
   *   mouse,
   *   audio,
   *   canvas,
   *   params: store.snapshot(),
   * }
   * ```
   */
  snapshot(): Record<string, unknown> {
    return Object.fromEntries(this.#params)
  }
}
