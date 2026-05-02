# ADR-001: User Journey — Visual Builder + npm Package

**Status:** Accepted  
**Date:** 2026-05-01

## Context

We needed to decide how users interact with funny-colors. Two distinct user groups exist:
- **Developers** who want to add a procedural background to an existing site with minimal friction
- **Designers / less-technical users** who want to experiment and discover effects visually

## Decision

Ship both: a visual node graph builder (web app) and an npm runtime package.

- `apps/web` — the builder; users design graphs, preview live output, export config
- `funny-colors` (npm) — the runtime; developers install it and pass a graph config

## Rationale

The builder lowers the barrier to discovery. The npm package is the production artifact — lean, no builder UI overhead. Most successful creative-coding tools (Leva, Theatre.js, cables.gl) use this exact split.

## Consequences

- The repo must maintain both a web app and a library — two distinct build pipelines
- The graph config format (JSON) becomes the contract between builder and runtime — it must be versioned and stable
