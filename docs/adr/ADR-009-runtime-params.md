# ADR-009: Runtime Parameter System — Param Store + Dirty Flagging

**Status:** Accepted  
**Date:** 2026-05-01

## Context

End users need to change background parameters at runtime (e.g. a slider on their site controls animation speed). We needed a mechanism that is lightweight, avoids full graph re-evaluation on every change, and has no reactive runtime dependency.

## Decision

Param store with dirty flagging:

- Named params are declared in `GraphConfig.params` (e.g. `{ speed: 0.8, colorA: '#ff00ff' }`)
- A `ParamNode` (Source type) reads from the store and feeds its value into the DAG
- `background.setParam('speed', 0.8)` marks the `ParamNode` and all downstream nodes dirty
- The next frame only re-evaluates the dirty subgraph — upstream unchanged nodes are skipped
- Public API: `createBackground(canvas, config)` returns `{ setParam(name, value): void, destroy(): void }`

## Rationale

- **No reactive dependency** — dirty flagging is simpler than signals/observables and adds no runtime package
- **Minimal re-work** — only the affected subgraph re-evaluates per `setParam` call
- **Reuses existing machinery** — dirty flagging is a small addition on top of the topological sort already needed for execution order
- **Explicit** — params are declared in the config; the host page cannot mutate arbitrary internal state

## Consequences

- `ParamNode` is a special Source node that must be registered in `@funny-colors/nodes`
- The param store lives in `@funny-colors/core` alongside the DAG engine
- Params changed within a single frame are batched — only one re-evaluation pass per frame regardless of how many `setParam` calls occurred
