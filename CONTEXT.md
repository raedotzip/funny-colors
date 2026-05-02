# funny-colors — System Context

## What this is

`funny-colors` is a plugin-based procedural background generation system. Users compose visual effects by connecting nodes in a graph editor, export the graph as a JSON config, and embed a lightweight runtime on their site.

The repo is a pnpm monorepo containing:
- The npm library end users install (`funny-colors`)
- The visual node graph builder (`apps/web`)
- The internal packages that power both

## What it is NOT

- Not a game engine or general-purpose shader editor
- Not server-side — all rendering happens in the browser via WebGL
- Not a React/Vue component library — the builder uses plain TypeScript + Handlebars

## Key concepts

| Term | Meaning |
|---|---|
| **Node** | A discrete processing unit with typed input/output ports and a pure `evaluate` function |
| **Graph** | A DAG (directed acyclic graph) of connected node instances |
| **GraphConfig** | The serialised JSON representation of a graph — produced by the builder, consumed by the runtime |
| **Plugin** | A third-party node type published to npm and registered with the runtime |
| **ExecutionContext** | Live data injected into Source nodes each frame (time, mouse, audio, params) |
| **RendererBackend** | The swappable graphics API abstraction (WebGL today, WebGPU later) |
| **ParamStore** | Named runtime values the host page can change via `background.setParam()` |

## Package dependency graph

```
apps/web
  └── @funny-colors/core
  └── @funny-colors/nodes
  └── @funny-colors/renderer

funny-colors (public)
  └── @funny-colors/core
  └── @funny-colors/nodes
  └── @funny-colors/renderer

@funny-colors/nodes
  └── @funny-colors/core

@funny-colors/renderer
  └── @funny-colors/core

@funny-colors/core
  (no internal deps)
```

## Architecture decisions

All decisions recorded in `docs/adr/`. Key ones:
- DAG evaluated per frame in JS; final output node compiles to GLSL (ADR-002, ADR-003)
- Plugins are pure `evaluate` functions + port schema — no classes (ADR-004)
- WebGL first; WebGPU added behind the same `RendererBackend` interface (ADR-003)
- `GraphEditorAdapter` interface decouples the builder from xyflow (ADR-012)

## Repo structure

```
apps/
  web/              Visual builder + demo site (Vite + Handlebars + plain TS)
packages/
  core/             DAG engine, type system, execution loop, GraphEditorAdapter interface
  nodes/            Built-in node library (tree-shakeable named exports)
  renderer/         RendererBackend interface + WebGL implementation
  funny-colors/     Public re-export package + CLI
  tsconfig/         Shared TypeScript configs (base / lib / app)
lib/
  compute/          Reserved: future Rust/WASM compute backend
docs/
  adr/              Architecture Decision Records (immutable)
  specs/            Technical specifications (DAG execution, shader compilation)
  design/           High-level design documents
  contributing/     Plugin authoring, node authoring, dev setup guides
  usage/            End-user how-to docs
```

## Running the project

```bash
pnpm install
pnpm turbo build       # build all packages
pnpm turbo test        # run all tests
pnpm --filter @funny-colors/web dev   # start the builder
```
