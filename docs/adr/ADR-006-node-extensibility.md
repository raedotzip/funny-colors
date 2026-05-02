# ADR-006: Node Type Extensibility — Discriminated Union + Capability Interfaces

**Status:** Accepted  
**Date:** 2026-05-01

## Context

The node taxonomy (ADR-005) needed to be extensible without requiring changes to existing node implementations when new types are added.

## Decision

Use a discriminated union of capability interfaces. Each node type extends `BaseNodeDefinition` with only the additional contract it needs:

```ts
interface BaseNodeDefinition {
  id: string
  type: NodeType   // discriminant
  label: string
  inputs: PortSchema[]
  outputs: PortSchema[]
  evaluate(inputs: PortValues, ctx: ExecutionContext): PortValues
}

interface BufferNodeDefinition extends BaseNodeDefinition {
  type: 'buffer'
  initState(): FrameState
}

type NodeDefinition =
  | TransformNodeDefinition
  | SourceNodeDefinition
  | BufferNodeDefinition
  | SamplerNodeDefinition
  | LogicNodeDefinition
  | GroupNodeDefinition
  | OutputNodeDefinition
```

The runtime dispatches on `node.type` only for types that deviate from the base `evaluate` contract (Buffer gets `FrameState` injected; Source skips upstream resolution). All other types fall through to base evaluation.

## Rationale

- Zero cost to existing nodes when a new type is added
- Type narrowing via discriminant is exhaustive — TypeScript warns if a new union member isn't handled
- Each type's special contract is explicit, documented, and compile-time checked

## Consequences

- New node types require a `never` exhaustiveness check to be added in the runtime dispatch switch
- Plugin authors must declare the correct `type` discriminant — the TypeScript compiler will reject incorrect port declarations (e.g. a Source with non-empty inputs)
