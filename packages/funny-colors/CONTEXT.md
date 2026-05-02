# funny-colors (public package) — Package Context

## Responsibility

The single public install point. This package:
- Re-exports all public APIs from `@funny-colors/core`, `@funny-colors/nodes`, and `@funny-colors/renderer`
- Exports the `createBackground()` runtime entry point
- Provides the `npx funny-colors build` CLI for compiling a graph JSON to a self-contained bundle

End users only interact with this package. They never install the internal `@funny-colors/*` packages directly.

## What it does NOT do

- Contains no original logic — it delegates entirely to the internal packages
- Is not the right place to add new node types or engine features

## Public API

```ts
import { createBackground } from 'funny-colors'
import type { GraphConfig, BackgroundInstance } from 'funny-colors'

const bg: BackgroundInstance = createBackground(canvas, graphConfig)
bg.setParam('speed', 0.5)
bg.destroy()
```

## Tree-shaking

All exports are named ESM exports. Bundlers (Vite, webpack, esbuild) eliminate unused node types automatically. A user who only uses `NoiseNode` and `ColorMapNode` ships only those two nodes — nothing else.

## CLI

```bash
npx funny-colors build my-graph.json
# outputs: my-graph.bundle.js — a self-contained JS file with no external deps
```

## Key files

| File | Purpose |
|---|---|
| `src/index.ts` | Re-exports all public APIs |
| `src/runtime.ts` | `createBackground()` implementation |
| `src/cli.ts` | CLI entry point |
