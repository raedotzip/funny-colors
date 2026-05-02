# ADR-005: Node Taxonomy — 7 Types, Enforced at Type Level

**Status:** Accepted  
**Date:** 2026-05-01

## Context

The system needed a clear taxonomy of node roles to enforce correct graph wiring and allow the runtime to apply type-specific execution strategies.

## Decision

Seven node types, enforced as a TypeScript discriminated union:

| Type | Has Inputs | Has Outputs | Has Frame State | Notes |
|---|---|---|---|---|
| Source | external only | yes | no | Reads from `ExecutionContext` (mouse, audio, time, params) |
| Transform | yes | yes | no | Pure computation |
| Buffer | yes | yes | yes | Maintains state across frames (trails, feedback) |
| Sampler | yes | yes | no | Reads from a gradient/texture/lookup table |
| Logic | yes | yes | no | Conditional routing (threshold, switch) |
| Group | yes | yes | no | Encapsulates a subgraph as a reusable node |
| Output | yes | no | no | Final rendering target |

The taxonomy is enforced through TypeScript interfaces. Source nodes declare `inputs: []`. Output nodes declare `outputs: []`. These constraints are checked at compile time.

## Rationale

Enforcing at the type level catches wiring mistakes (e.g. connecting to an Output's non-existent output port) at compile time rather than runtime. It also allows the DAG engine to optimise traversal — Source nodes always execute first, Output nodes always execute last, Buffer nodes receive their `FrameState` automatically.

## Consequences

- Adding a new node type requires: 1 new interface + 1 union entry + 1 runtime dispatch case
- No existing nodes need to change when a new type is added
- Buffer nodes are the only type with mutable state — this is intentional and explicit
