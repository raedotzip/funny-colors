# ADR-007: Export Format — npm Runtime + Graph JSON Config

**Status:** Accepted  
**Date:** 2026-05-01

## Context

We needed to decide what end users receive when they export from the builder and how they embed the result in their site. Options: self-contained JS bundle, raw GLSL + bootstrap, or config JSON + runtime package.

The additional constraint: the author wants to track installs without adding telemetry overhead.

## Decision

Hybrid approach:

1. **npm runtime** — users install `funny-colors` and call `createBackground(canvas, graphConfig)`
2. **Graph JSON config** — the builder exports a serialised `GraphConfig` that the runtime interprets
3. **Optional CLI** — `npx funny-colors build my-graph.json` produces a self-contained bundle for zero-install embed use

```ts
import { createBackground } from 'funny-colors'
import myGraph from './my-graph.json'

const bg = createBackground(document.getElementById('canvas'), myGraph)
bg.setParam('speed', 0.8)
```

## Rationale

- **Install tracking** — npm tracks weekly/monthly download counts at `npmjs.com/package/funny-colors` automatically. No telemetry code required.
- **Tree-shaking** — ESM named exports + `exports` field in `package.json` allow bundlers to eliminate unused node types
- **Power users** — the JSON config format is documented and hand-authorable without using the builder
- **Zero-install** — the CLI bundle option serves users who can't or won't use npm

## Consequences

- `GraphConfig` becomes a public, versioned schema — breaking changes require a major version bump
- The runtime must remain lightweight; heavy dependencies belong in the builder, not the runtime
