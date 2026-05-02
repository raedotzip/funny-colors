# apps/web — Package Context

## Responsibility

The visual node graph builder and demo site. This is where users:
1. Browse available node types in the node palette
2. Drag nodes onto the canvas and connect their ports
3. Configure node parameters via the inspector panel
4. Preview the live rendered output
5. Export their graph as a `GraphConfig` JSON

## Stack

- **Vite** — dev server and build tool
- **Plain TypeScript** — no framework (no React, no Vue)
- **Handlebars** — template engine for node cards, panels, and UI components
- **xyflow (`@xyflow/system`)** — graph canvas mechanics (drag, connect, zoom/pan)
- **Vitest + @testing-library/dom** — unit and integration tests
- **Playwright** — E2E tests and visual regression

## What it does NOT do

- Does not contain any node logic or rendering code — it imports from `@funny-colors/*`
- Does not depend on xyflow directly outside of `src/adapters/xyflow-adapter.ts`

## Key files

| File | Purpose |
|---|---|
| `src/adapters/xyflow-adapter.ts` | Implements `GraphEditorAdapter` using xyflow — the ONLY file that imports xyflow |
| `src/builder/` | Builder state machine and UI orchestration |
| `src/templates/` | Handlebars `.hbs` template files for UI components |
| `src/main.ts` | App entry point |

## GraphEditorAdapter

The rest of the app depends on `GraphEditorAdapter` (from `@funny-colors/core`), never on xyflow directly. To swap xyflow for a custom implementation: replace `xyflow-adapter.ts` only.

## Testing

- Unit/integration: Vitest + `@testing-library/dom` for state and DOM assertions
- Browser: Vitest browser mode for anything needing a real DOM
- E2E + visual regression: Playwright
- Target: near 100% coverage
