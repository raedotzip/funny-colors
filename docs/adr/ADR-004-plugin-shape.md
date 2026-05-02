# ADR-004: Plugin Shape — Function + Schema

**Status:** Accepted  
**Date:** 2026-05-01

## Context

We needed to decide the authoring contract for node plugins. Options: class-based (extends `Node`), declarative config object, or function + attached schema.

The priorities were: speed, small bundle size, testability, and support for live inputs (audio, mouse).

## Decision

A plugin is a plain object with a pure `evaluate` function and a typed port schema:

```ts
const myNode: TransformNodeDefinition = {
  id: 'noise/fbm',
  type: 'transform',
  label: 'FBM Noise',
  inputs: [
    { name: 'position', type: 'vec2' },
    { name: 'scale', type: 'float', default: 1.0 },
  ],
  outputs: [
    { name: 'value', type: 'float' },
  ],
  evaluate({ position, scale }) {
    // pure computation
    return { value: fbm(position, scale) }
  },
}
```

## Rationale

- **Speed** — pure functions are JIT-friendly; no `this` lookups, no class overhead
- **Size** — fully tree-shakeable; bundlers eliminate unused nodes trivially
- **Testability** — `evaluate(inputs)` is called directly in tests; no setup, no mocks
- **Live inputs** — Source nodes receive an `ExecutionContext` parameter instead of upstream `inputs`; same shape, different data source

## Consequences

- No lifecycle hooks (`onInit`, `onDestroy`) by default; may be added as optional fields later if needed
- Plugin isolation is natural — no shared state between node instances by design
- All nodes must be stateless unless they are Buffer type (which receives explicit `FrameState`)
