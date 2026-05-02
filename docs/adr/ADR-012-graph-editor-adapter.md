# ADR-012: Node Graph Editor — xyflow Behind GraphEditorAdapter Interface

**Status:** Accepted  
**Date:** 2026-05-01

## Context

The builder needs a node graph canvas with drag-to-connect ports, node repositioning, and zoom/pan. Building this from scratch is a multi-week effort that distracts from the core value of the system.

## Decision

Use `@xyflow/system` (framework-agnostic core of xyflow) behind a `GraphEditorAdapter` interface defined in `@funny-colors/core`.

```ts
interface GraphEditorAdapter {
  mount(container: HTMLElement): void
  setNodes(nodes: GraphNode[]): void
  setEdges(edges: GraphEdge[]): void
  onConnect(cb: (from: PortRef, to: PortRef) => void): void
  onNodeMove(cb: (instanceId: string, pos: Vec2) => void): void
  destroy(): void
}
```

The `XyflowAdapter` class in `apps/web/src/adapters/xyflow-adapter.ts` is the ONLY file that imports from xyflow. The rest of the builder depends on the interface, never on xyflow.

## Rationale

- **Saves time** — avoids reimplementing drag-and-connect, bezier connection drawing, zoom/pan
- **Swappable** — replacing xyflow with a custom implementation requires changing one file
- **Decoupled** — the interface is defined in `@funny-colors/core` so it can be documented and tested independently of any implementation

## Consequences

- `@xyflow/system` is a `devDependency` of `apps/web` only — it never enters the production npm package
- Handlebars templates own the visual design of node cards; xyflow owns only the canvas mechanics (positioning, connections, viewport)
- If xyflow's API changes, only `xyflow-adapter.ts` needs updating
