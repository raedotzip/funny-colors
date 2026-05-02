# ADR-002: Execution Model — Per-Frame DAG Evaluation

**Status:** Accepted  
**Date:** 2026-05-01

## Context

We needed to decide how nodes execute. Options considered: reactive streams (RxJS-style), compiled shader graph (no JS at runtime), or a DAG evaluated in JS each frame.

## Decision

DAG (directed acyclic graph) evaluated per frame in JavaScript.

- Nodes are independent — each is a pure function with typed inputs/outputs
- No side effects or shared mutable state between nodes
- The final Output node compiles the resolved DAG into GPU shader code
- End users ship only the compiled GPU artifact — not the node graph or JS DAG engine

## Rationale

- **Independence** — each node can be developed, tested, and published in isolation
- **Simplicity** — the plugin API is just a function: `evaluate(inputs, ctx) → outputs`
- **Testability** — pure functions need no DOM, no GPU, no mocks
- **Separation** — JS handles logic/composition; GPU handles rendering

## Consequences

- Per-frame JS evaluation adds a small overhead vs. a fully compiled shader; acceptable at the node counts expected for backgrounds
- Buffer nodes (stateful across frames) require special handling in the execution loop — they cannot be pure (see ADR-005 node taxonomy)
