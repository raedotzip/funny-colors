# ADR-008: Monorepo Package Structure — Layered Split

**Status:** Accepted  
**Date:** 2026-05-01

## Context

We needed to decide how to split the codebase into packages. Options: minimal split (core + web), layered split (4 packages), or plugin-first split (built-in nodes treated identically to third-party plugins).

## Decision

Layered split — 4 internal packages, 1 public re-export, 1 app:

```
packages/
  core/           DAG engine, type system, execution loop, GraphEditorAdapter interface
  nodes/          Built-in node library (tree-shakeable named exports)
  renderer/       RendererBackend interface + WebGL implementation
  funny-colors/   Public re-export package + CLI
  tsconfig/       Shared TypeScript configs
apps/
  web/            Visual builder + demo site
lib/
  compute/        Reserved: future Rust/WASM compute backend
```

End users install only `funny-colors`. The `@funny-colors/*` packages are internal implementation details.

## Rationale

- **Separation of concerns** — the engine (core), node library (nodes), and rendering backend (renderer) evolve independently
- **Backend swappability** — adding WebGPU requires only a new file in `packages/renderer/`; core and nodes are unaffected
- **Single install point** — `funny-colors` re-exports everything; users never need to know about the internal packages
- Plugin-first split (C) was rejected: it would require users to install 5+ packages for a working setup

## Consequences

- `@funny-colors/core` has no runtime dependencies — it must stay that way
- Dependency direction is strictly one-way: `web` and `funny-colors` → `renderer` → `core`; `nodes` → `core`. No cycles.
- Adding `lib/compute` in future requires updating `pnpm-workspace.yaml` only
