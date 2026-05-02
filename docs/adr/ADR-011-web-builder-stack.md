# ADR-011: Web Builder UI Stack — Plain TypeScript + Handlebars

**Status:** Accepted  
**Date:** 2026-05-01

## Context

The builder web app needs a UI layer. Options included React, Vue, Svelte, or a no-framework approach.

## Decision

Plain TypeScript with Handlebars for templating. No JS framework.

- Handlebars renders node cards, panels, toolbars, settings UI
- Vanilla TypeScript handles all interactivity and state management
- No React/Vue/Svelte runtime dependency

## Rationale

- **Bundle size** — no framework runtime overhead shipped to users previewing the builder
- **Simplicity** — the builder UI structure is relatively static (panels, palette, canvas); a framework's reactivity model adds more complexity than value here
- **Aligned with project values** — the library itself is framework-free; the builder should match

## Consequences

- The team must manage DOM updates and state transitions manually — more code than a reactive framework for complex UI interactions
- Handlebars renders templates as strings — re-renders require replacing DOM subtrees rather than diffing
- Interactive graph canvas (drag/connect/zoom) is handled by the `GraphEditorAdapter` (xyflow), not Handlebars
- Complex builder state (undo/redo, multi-select) will need a hand-rolled state machine
