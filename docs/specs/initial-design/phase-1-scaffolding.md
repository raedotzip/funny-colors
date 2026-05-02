# Phase 1 Tech Spec: Repo Scaffolding + Documentation

## Status: COMPLETE

This phase is finished. This document records what was built and why, so future contexts have a reference point.

---

## What was built

### Workspace config

| File | Purpose |
|---|---|
| `pnpm-workspace.yaml` | Declares `apps/*`, `packages/*`, `lib/*` as workspace members |
| `package.json` (root) | Root scripts: `pnpm turbo build/test/lint/typecheck/clean`. DevDeps: turbo, typescript. Engines: node ≥20, pnpm ≥9. |
| `turbo.json` | Build pipeline: `build` depends on `^build` (upstream first). `test` depends on `^build`. `lint` and `typecheck` are independent. |
| `.npmrc` (pre-existing) | `auto-install-peers=true`, `prefer-workspace-packages=true` — already configured correctly |

### Package structure

5 packages + 1 app created. All have `package.json`, `tsconfig.json`, `tsup.config.ts` (libraries), and source stubs.

```
packages/
  core/             @funny-colors/core — DAG engine, all public interfaces
  nodes/            @funny-colors/nodes — built-in node library
  renderer/         @funny-colors/renderer — graphics backend abstraction
  funny-colors/     funny-colors (public) — re-export + CLI
  tsconfig/         @funny-colors/tsconfig — shared TS config presets (base/lib/app)
apps/
  web/              @funny-colors/web — visual builder
```

### TypeScript config

`packages/tsconfig/` provides three presets:
- `base.json` — strict TS settings, ESNext module, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- `lib.json` — extends base, adds `composite: true` for project references
- `app.json` — extends base, adds DOM libs, `noEmit: true`

Each package extends the appropriate preset. Root `tsconfig.json` uses project references for IDE support.

### Source stubs

All packages have minimal source files so the build pipeline doesn't error. Key file already fully implemented:

**`packages/core/src/types.ts`** — complete. All public interfaces defined:
- `PortSchema`, `PortValues`, `PortValueType`
- `ExecutionContext`
- All 7 `NodeDefinition` types (`TransformNodeDefinition`, `SourceNodeDefinition`, `BufferNodeDefinition`, `SamplerNodeDefinition`, `LogicNodeDefinition`, `GroupNodeDefinition`, `OutputNodeDefinition`)
- `NodeDefinition` discriminated union + `NodeType`
- `FrameState`
- `GraphNode`, `GraphEdge`, `GraphConfig` (the serialised user graph)
- `GraphEditorAdapter`, `PortRef`, `Vec2`
- `BackgroundInstance`

`dag.ts` and `param-store.ts` are stubs — implemented in Phase 2.

**`packages/renderer/src/backend.ts`** — complete. `RendererBackend` and `CompiledProgram` interfaces defined.

**`packages/funny-colors/src/runtime.ts`** — stub that throws. Implemented in Phase 5.

**`packages/funny-colors/src/cli.ts`** — stub that exits with error. Implemented in Phase 5.

### Documentation

**CONTEXT.md files** (6 total):
- `CONTEXT.md` — root system overview, package dependency graph, key concepts, repo structure
- `packages/core/CONTEXT.md`
- `packages/nodes/CONTEXT.md`
- `packages/renderer/CONTEXT.md`
- `packages/funny-colors/CONTEXT.md`
- `apps/web/CONTEXT.md`

**ADRs** (`docs/adr/`) — 14 files, one per design decision:

| ADR | Decision |
|---|---|
| ADR-001 | User journey: visual builder + npm package |
| ADR-002 | Execution model: per-frame DAG evaluation in JS |
| ADR-003 | Graphics API: IR abstraction, WebGL first |
| ADR-004 | Plugin shape: function + schema |
| ADR-005 | Node taxonomy: 7 types, type-enforced |
| ADR-006 | Node extensibility: discriminated union + capability interfaces |
| ADR-007 | Export format: npm runtime + graph JSON config |
| ADR-008 | Monorepo structure: layered split, 4 internal packages |
| ADR-009 | Runtime params: param store + dirty flagging |
| ADR-010 | Build tooling: Turborepo + tsup |
| ADR-011 | Web builder stack: plain TS + Handlebars |
| ADR-012 | Graph editor: xyflow behind GraphEditorAdapter interface |
| ADR-013 | Testing: Vitest, near 100% coverage |
| ADR-014 | Documentation: AI-navigable, multi-context-window |

**Tech specs** (`docs/specs/`) — 5 files covering Phases 2–6 (this file is Phase 1).

**Contributing docs** (`docs/contributing/`):
- `writing-a-plugin.md` — full guide for third-party plugin authors

**Usage docs** (`docs/usage/`):
- `getting-started.md` — install, basic usage, tree-shaking, CLI, params

---

## Dependency versions (in package.json at time of writing)

| Package | Version |
|---|---|
| turbo | ^2.0.0 |
| typescript | ^5.5.0 |
| tsup | ^8.0.0 |
| vitest | ^2.0.0 |
| @vitest/coverage-v8 | ^2.0.0 |
| @vitest/browser | ^2.0.0 |
| playwright | ^1.45.0 |
| vite | ^5.0.0 |
| handlebars | ^4.7.8 |
| @xyflow/system | ^0.0.46 |

Run `pnpm install` before starting Phase 2.

---

## Verification

Phase 1 is infrastructure-only — no compilable TypeScript yet (stubs have no real impl). To verify Phase 1 is intact:

```bash
# Check all package.json files parse correctly
find . -name 'package.json' -not -path '*/node_modules/*' | xargs -I{} node -e "require('{}')" 2>&1

# Check all tsconfig files parse correctly
find . -name 'tsconfig*.json' -not -path '*/node_modules/*' | xargs -I{} node -e "JSON.parse(require('fs').readFileSync('{}','utf8'))" 2>&1

# Verify all ADRs exist
ls docs/adr/

# Verify all CONTEXT.md files exist
find . -name 'CONTEXT.md' -not -path '*/node_modules/*'
```

---

## What comes next

**Phase 2** — implement the DAG engine and param store in `packages/core`. See `docs/specs/phase-2-core.md`.

Before starting Phase 2, run:
```bash
pnpm install
```
