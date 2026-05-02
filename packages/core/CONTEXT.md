# @funny-colors/core — Package Context

## Responsibility

The DAG engine and type system. This package is the heart of funny-colors:
- Defines every public TypeScript interface used across the monorepo
- Implements the graph execution loop (topological sort → per-frame evaluation → dirty flagging)
- Owns the param store (named runtime values + downstream dirty marking)
- Declares the `GraphEditorAdapter` interface (implemented by `apps/web`, not here)

## What it does NOT do

- Does not render anything — no WebGL, no DOM, no canvas
- Does not contain node implementations — those live in `@funny-colors/nodes`
- Does not contain the graphics backend — that lives in `@funny-colors/renderer`
- Has zero runtime dependencies outside of the TypeScript standard library

## Key files

| File | Purpose |
|---|---|
| `src/types.ts` | All public interfaces: `NodeDefinition`, `GraphConfig`, `ExecutionContext`, `BackgroundInstance`, `GraphEditorAdapter` |
| `src/dag.ts` | DAG engine: topological sort, frame evaluation loop, dirty flagging |
| `src/param-store.ts` | Param store: named values, dirty marking, downstream propagation |

## Node taxonomy

Seven node types enforced as a TypeScript discriminated union in `types.ts`:

- **Source** — no upstream inputs; reads from `ExecutionContext` (mouse, audio, time, params)
- **Transform** — pure computation; inputs from upstream nodes
- **Buffer** — stateful across frames; owns a `FrameState` object
- **Sampler** — maps a value through a lookup table or gradient
- **Logic** — conditional/threshold operations
- **Group** — encapsulates a subgraph as a reusable node
- **Output** — final rendering target; no downstream outputs

## Execution model

1. Topological sort resolves evaluation order
2. Each frame: Source nodes receive `ExecutionContext`, all others receive upstream `PortValues`
3. Buffer nodes receive their previous `FrameState` alongside inputs
4. `setParam()` marks the `ParamNode` and all downstream nodes dirty — only the dirty subgraph re-evaluates

## Testing

Pure unit tests via Vitest. No DOM, no GPU, no browser required.
Target: near 100% coverage.
