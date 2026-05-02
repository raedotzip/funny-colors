# Technical Specifications

**Start here:** [system-spec.md](system-spec.md) — the canonical technical reference for the entire system. Read this before any phase spec.

Each phase spec is a complete, self-contained brief for a single implementation phase. A fresh Claude context can read one spec and execute it without needing to read the rest of the repo — as long as the prerequisites are met.

## Execution order

Phases must be executed in order. Each phase depends on the previous.

| Phase | Spec | Package | Status | Depends on |
|---|---|---|---|---|
| 1 | [phase-1-scaffolding.md](phase-1-scaffolding.md) | Monorepo setup + all docs | **Complete** | — |
| 2 | [phase-2-core.md](initial-design/phase-2-core.md) | `@funny-colors/core` | **Complete** | Phase 1 |
| 3 | [phase-3-renderer.md](phase-3-renderer.md) | `@funny-colors/renderer` | Pending | Phase 2 |
| 4 | [phase-4-nodes.md](phase-4-nodes.md) | `@funny-colors/nodes` | Pending | Phases 2 + 3 |
| 5 | [phase-5-public-package.md](phase-5-public-package.md) | `funny-colors` | Pending | Phases 2 + 3 + 4 |
| 6 | [phase-6-web-builder.md](phase-6-web-builder.md) | `apps/web` | Pending | Phases 2 + 3 + 4 + 5 |

## How to start a new context on a phase

1. Read `CONTEXT.md` at the repo root
2. Read the target phase spec in full
3. Read the files listed in the spec's **Prerequisites** section
4. Execute the spec

Do not read files not listed in the spec unless you hit an unexpected gap — the specs are designed to be self-contained.

## Definition of done (global)

A phase is complete when:
- All listed files exist and contain real implementations (no stubs or `throw new Error('not implemented')`)
- All tests pass with coverage thresholds met
- `pnpm turbo build` and `pnpm turbo test` pass from the repo root without errors
