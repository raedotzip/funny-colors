# Phase 2 Tech Spec: `@funny-colors/core`

## Prerequisites

Phase 1 complete. The following files already exist and must not be changed:
- `packages/core/src/types.ts` — all public interfaces (read this first)
- `packages/core/src/dag.ts` — stub (implement here)
- `packages/core/src/param-store.ts` — stub (implement here)
- `packages/core/package.json`, `tsconfig.json`, `tsup.config.ts`

Read `packages/core/CONTEXT.md` and `docs/adr/ADR-002-execution-model.md` before starting.

---

## Goal

Implement the DAG engine and param store. No rendering, no DOM, no GPU. Pure TypeScript.

---

## Files to create / modify

```
packages/core/src/
  types.ts          (exists — do not modify)
  dag.ts            (implement)
  param-store.ts    (implement)
  index.ts          (exists — ensure all exports are present)
  dag.test.ts       (create)
  param-store.test.ts (create)
  types.test.ts     (create — type-level tests)
```

---

## 1. `src/dag.ts` — DAG Engine

### Responsibilities
- Build a topologically sorted evaluation order from a `GraphConfig`
- Evaluate the graph each frame: Source nodes first, Output nodes last
- Inject `ExecutionContext` into Source nodes
- Inject `FrameState` into Buffer nodes and persist updated state
- Skip nodes that are not dirty (optimisation — required for param store integration)

### Types to import from `./types.ts`
`GraphConfig`, `GraphNode`, `GraphEdge`, `NodeDefinition`, `PortValues`, `ExecutionContext`, `FrameState`, `NodeType`

### Implementation

#### `buildEvaluationOrder(config: GraphConfig): string[]`
- Input: a `GraphConfig` (nodes + edges)
- Output: array of `instanceId` strings in topological order (Sources first, Output last)
- Algorithm: Kahn's algorithm (BFS-based topological sort)
- Must throw `CyclicGraphError` if the graph contains a cycle

```ts
export class CyclicGraphError extends Error {
  constructor() { super('Graph contains a cycle') }
}
```

#### `createDagRunner(config: GraphConfig, registry: NodeRegistry): DagRunner`

`NodeRegistry` maps `definitionId → NodeDefinition`. The runner holds the evaluation state.

```ts
export interface NodeRegistry {
  get(definitionId: string): NodeDefinition | undefined
}

export interface DagRunner {
  /** Evaluate all dirty nodes. Call once per animation frame. */
  evaluate(ctx: ExecutionContext): void
  /** Mark a node and all its descendants dirty. */
  markDirty(instanceId: string): void
  /** Destroy the runner and release frame state. */
  destroy(): void
}
```

**`evaluate(ctx)` algorithm:**
1. Iterate `evaluationOrder` (pre-sorted at construction)
2. For each node instance:
   - Skip if not dirty and not a Source node (Source nodes always re-evaluate because `ctx` changes every frame)
   - Look up `NodeDefinition` from registry
   - Resolve inputs: for each input port, find the upstream edge and use the cached output value; use port `default` if no edge
   - Dispatch by `node.type`:
     - `'source'`: call `evaluate({}, ctx)` — inputs are always empty, ctx provides data
     - `'buffer'`: call `evaluate(resolvedInputs, ctx)` with `FrameState` appended to ctx; persist returned state
     - all others: call `evaluate(resolvedInputs, ctx)`
   - Cache the output `PortValues` for downstream nodes to consume
   - Mark node clean

**Buffer state storage:**
- `DagRunner` internally holds `Map<instanceId, FrameState>`
- On construction, call `initState()` for each Buffer node and store the result
- On each Buffer evaluation, pass current state to `evaluate` via a dedicated key in ctx (e.g. `ctx.__frameState`) and read updated state from the return value under `__nextFrameState`

> Note: the `FrameState` contract between `dag.ts` and buffer nodes is internal — it does not leak into public types.

**Dirty tracking:**
- All nodes start dirty on construction
- After a node evaluates successfully, mark it clean
- `markDirty(instanceId)` marks the node AND all transitive descendants dirty (walk the edge list forward)

---

## 2. `src/param-store.ts` — Param Store

### Responsibilities
- Hold named runtime param values
- Notify the DAG runner when a param changes (so it can mark downstream nodes dirty)

### Implementation

```ts
export interface ParamStore {
  get(name: string): unknown
  set(name: string, value: unknown): void
  /** Register a listener called whenever a param changes. */
  onChange(cb: (name: string, value: unknown) => void): () => void
}

export function createParamStore(initial: Record<string, unknown>): ParamStore
```

- `set()` must call all registered `onChange` listeners synchronously
- Multiple `set()` calls within the same microtask are NOT batched here — batching is the runner's responsibility (it debounces dirty-marking to once per `requestAnimationFrame`)
- `onChange` returns an unsubscribe function

---

## 3. Vitest configuration

Create `packages/core/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 90,
        statements: 95,
      },
    },
  },
})
```

---

## 4. Tests

### `src/dag.test.ts`

Cover:
- Topological sort: linear chain, diamond, multi-source
- `CyclicGraphError` thrown on a cycle
- Source nodes always re-evaluate (even when clean)
- Buffer nodes receive and return `FrameState`
- Dirty flagging: only dirty nodes re-evaluate
- `markDirty` propagates to all descendants
- Correct port value resolution (upstream output → downstream input)
- Default port values used when no upstream edge

### `src/param-store.test.ts`

Cover:
- `get` returns initial values
- `set` updates the value
- `onChange` listener is called on `set`
- Unsubscribe function stops future calls
- Multiple listeners can be registered

### `src/types.test.ts`

Compile-time checks using `@ts-expect-error`:
- `SourceNodeDefinition` with non-empty inputs fails
- `OutputNodeDefinition` with non-empty outputs fails
- `BufferNodeDefinition` without `initState` fails
- Valid definitions for all 7 node types compile without error

---

## Definition of done

- [ ] `pnpm --filter @funny-colors/core build` succeeds — generates `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts`
- [ ] `pnpm --filter @funny-colors/core test` passes with ≥95% line coverage
- [ ] No TypeScript errors (`pnpm --filter @funny-colors/core typecheck`)
- [ ] `CyclicGraphError` is exported from `src/index.ts`
- [ ] `DagRunner`, `NodeRegistry`, `ParamStore`, `createParamStore`, `createDagRunner`, `buildEvaluationOrder` are all exported
