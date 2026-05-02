# Phase 6 Tech Spec: `apps/web` — Visual Builder

## Prerequisites

Phases 2–5 complete. All packages build cleanly. `createBackground()` is functional.

Read before starting:
- `apps/web/CONTEXT.md`
- `packages/core/src/types.ts` — `GraphConfig`, `GraphNode`, `GraphEdge`, `GraphEditorAdapter`, `PortRef`, `Vec2`
- `docs/adr/ADR-011-web-builder-stack.md`
- `docs/adr/ADR-012-graph-editor-adapter.md`

---

## Goal

Build the visual node graph builder. Users can:
1. Browse the node palette
2. Drag nodes onto the canvas and connect ports
3. Inspect and configure node parameters
4. See a live preview of the rendered output
5. Export the graph as `GraphConfig` JSON

---

## Stack

- **Vite** — dev server and build
- **Plain TypeScript** — no framework
- **Handlebars** — UI templates (node cards, panels, modals)
- **`@xyflow/system`** — graph canvas mechanics, behind `XyflowAdapter`

---

## File structure

```
apps/web/src/
  main.ts                       App entry point
  adapters/
    xyflow-adapter.ts           XyflowAdapter implements GraphEditorAdapter
    xyflow-adapter.test.ts
  builder/
    state.ts                    Builder state machine
    state.test.ts
    actions.ts                  Pure action handlers (add node, connect, delete, etc.)
    actions.test.ts
    export.ts                   Serialise builder state → GraphConfig JSON
    export.test.ts
  preview/
    preview.ts                  Manages the live canvas preview (calls createBackground)
    preview.test.ts
  templates/
    node-card.hbs               Node card template
    port.hbs                    Port (input/output) template
    palette-item.hbs            Node palette entry template
    inspector-panel.hbs         Right-side inspector template
    toolbar.hbs                 Top toolbar template
  ui/
    palette.ts                  Node palette panel logic
    inspector.ts                Inspector panel logic
    toolbar.ts                  Toolbar logic
    templates.ts                Handlebars template loader + compile helper
  index.html
  style.css
apps/web/
  vite.config.ts
  vitest.config.ts
  playwright.config.ts
  e2e/
    builder.spec.ts             Playwright E2E tests
```

---

## 1. Builder State Machine (`src/builder/state.ts`)

The builder has a single state object. No framework reactivity — mutations are explicit and tracked.

```ts
export interface BuilderState {
  nodes: GraphNode[]
  edges: GraphEdge[]
  params: Record<string, unknown>
  selectedNodeId: string | null
  isDirty: boolean           // unsaved changes
}

export function createInitialState(): BuilderState

export type BuilderAction =
  | { type: 'ADD_NODE'; definitionId: string; position: Vec2 }
  | { type: 'MOVE_NODE'; instanceId: string; position: Vec2 }
  | { type: 'DELETE_NODE'; instanceId: string }
  | { type: 'CONNECT_PORTS'; from: PortRef; to: PortRef }
  | { type: 'DISCONNECT_EDGE'; edgeIndex: number }
  | { type: 'SELECT_NODE'; instanceId: string | null }
  | { type: 'SET_PARAM'; name: string; value: unknown }
  | { type: 'LOAD_CONFIG'; config: GraphConfig }
  | { type: 'MARK_SAVED' }
```

`dispatch(state, action) → BuilderState` — pure reducer, returns a new state object.

**Validation rules enforced in `CONNECT_PORTS`:**
- Source port type must match target port type
- No connecting a port to itself
- No duplicate edges on the same input port (one input per port)
- No connecting an Output node's outputs or a Source node's inputs

---

## 2. `src/adapters/xyflow-adapter.ts` — XyflowAdapter

Implements `GraphEditorAdapter` from `@funny-colors/core`. This is the **only file** that imports anything from `@xyflow/system`.

```ts
import type { GraphEditorAdapter, GraphNode, GraphEdge, PortRef, Vec2 } from '@funny-colors/core'
import { /* xyflow system APIs */ } from '@xyflow/system'

export class XyflowAdapter implements GraphEditorAdapter {
  mount(container: HTMLElement): void
  setNodes(nodes: GraphNode[]): void
  setEdges(edges: GraphEdge[]): void
  onConnect(cb: (from: PortRef, to: PortRef) => void): void
  onNodeMove(cb: (instanceId: string, pos: Vec2) => void): void
  destroy(): void
}
```

**Node rendering in xyflow:**
- xyflow positions nodes; Handlebars renders the node card HTML
- In `setNodes()`, for each node: compile the `node-card.hbs` template to an HTML string, inject it as the xyflow node's content
- Port handles map to xyflow's connection handle system

---

## 3. `src/ui/templates.ts` — Handlebars Template Loader

```ts
import Handlebars from 'handlebars'

/** Pre-compiles a .hbs template. Call once at startup. */
export function loadTemplate(name: string, source: string): HandlebarsTemplateDelegate

/** Render a pre-compiled template with data. */
export function render(template: HandlebarsTemplateDelegate, data: unknown): string
```

Import `.hbs` files via Vite's raw import:

```ts
import nodeCardSrc from '../templates/node-card.hbs?raw'
export const nodeCardTemplate = loadTemplate('node-card', nodeCardSrc)
```

---

## 4. Handlebars templates

### `node-card.hbs`

```handlebars
<div class="node node--{{type}}" data-instance-id="{{instanceId}}">
  <div class="node__header">
    <span class="node__label">{{label}}</span>
  </div>
  <div class="node__ports">
    <div class="node__inputs">
      {{#each inputs}}
        {{> port direction="input" }}
      {{/each}}
    </div>
    <div class="node__outputs">
      {{#each outputs}}
        {{> port direction="output" }}
      {{/each}}
    </div>
  </div>
</div>
```

### `port.hbs`

```handlebars
<div class="port port--{{direction}} port--type-{{type}}" data-port="{{name}}">
  <div class="port__handle"></div>
  <span class="port__label">{{name}}</span>
</div>
```

---

## 5. `src/preview/preview.ts` — Live Preview

```ts
import { createBackground } from 'funny-colors'
import type { GraphConfig, BackgroundInstance } from 'funny-colors'

export interface PreviewManager {
  /** Re-compile and restart the preview with the new config. */
  update(config: GraphConfig): void
  destroy(): void
}

export function createPreviewManager(canvas: HTMLCanvasElement): PreviewManager
```

`update()` calls `bg.destroy()` if an instance exists, then calls `createBackground(canvas, config)`.

Debounce `update()` calls by 300ms — the user may be in the middle of connecting nodes.

---

## 6. `src/main.ts` — Entry Point

```ts
// 1. Load all node definitions from @funny-colors/nodes into the palette
// 2. Instantiate XyflowAdapter, mount to #graph-canvas
// 3. Instantiate PreviewManager on #preview-canvas
// 4. Wire xyflow adapter callbacks → dispatch BuilderActions
// 5. On every state change: call adapter.setNodes/setEdges + preview.update
// 6. Wire toolbar buttons (export, save, load)
```

---

## 7. `src/builder/export.ts`

```ts
export function exportConfig(state: BuilderState): GraphConfig
export function importConfig(json: unknown): BuilderState  // validates and throws on invalid
```

`exportConfig` serialises `BuilderState → GraphConfig` (strips UI-only fields like `selectedNodeId`, `isDirty`).

---

## 8. Vite configuration (`vite.config.ts`)

```ts
import { defineConfig } from 'vite'
import handlebars from 'vite-plugin-handlebars'

export default defineConfig({
  plugins: [
    handlebars({ partialDirectory: './src/templates' }),
  ],
})
```

Add `vite-plugin-handlebars` to `devDependencies`.

---

## 9. Tests

### `src/builder/state.test.ts` and `actions.test.ts` (Vitest, Node)

- `ADD_NODE` appends a node with a unique `instanceId`
- `DELETE_NODE` removes the node and all connected edges
- `CONNECT_PORTS` adds an edge; rejects mismatched types; rejects duplicate input connections
- `MOVE_NODE` updates position
- `LOAD_CONFIG` replaces state with loaded config
- State is immutable — each dispatch returns a new object

### `src/builder/export.test.ts` (Vitest, Node)

- `exportConfig` round-trips through `importConfig` without data loss
- `importConfig` throws on missing `version` field
- `importConfig` throws on unknown version

### `src/adapters/xyflow-adapter.test.ts` (Vitest browser mode)

- `mount` attaches xyflow to the container element
- `onConnect` callback is called when ports are connected
- `onNodeMove` callback is called when a node is dragged
- `destroy` removes the xyflow instance

### `e2e/builder.spec.ts` (Playwright)

Golden paths:
- User opens the builder, palette shows all node types
- User drags a `TimeNode` and a `CanvasOutputNode` onto the canvas
- User connects `TimeNode.time → CanvasOutputNode.color`
- Preview canvas renders without errors
- User clicks Export and receives a valid JSON download

Visual regression:
- Screenshot the canvas after the time → output connection is made
- Compare against baseline

---

## `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['e2e/**'],
    browser: {
      enabled: true,
      name: 'chromium',
      provider: 'playwright',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/templates/**', 'e2e/**'],
      thresholds: { lines: 85, functions: 85, branches: 80, statements: 85 },
    },
  },
})
```

---

## Definition of done

- [ ] `pnpm --filter @funny-colors/web build` succeeds
- [ ] `pnpm --filter @funny-colors/web test` passes
- [ ] `pnpm --filter @funny-colors/web test:e2e` golden path E2E passes
- [ ] No TypeScript errors
- [ ] `XyflowAdapter` is the only file importing from `@xyflow/system`
- [ ] Live preview updates when nodes are connected
- [ ] Export button produces a valid `GraphConfig` JSON
- [ ] `pnpm --filter @funny-colors/web dev` starts a dev server and the builder is usable in a browser
