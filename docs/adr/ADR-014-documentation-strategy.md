# ADR-014: Documentation Strategy — AI-Navigable, Multi-Context-Window

**Status:** Accepted  
**Date:** 2026-05-01

## Context

The codebase will be developed across multiple Claude context windows and by multiple contributors. Documentation must be self-contained enough that a fresh agent or developer can pick up any single package and understand it without reading the entire repo.

## Decision

A full documentation suite at multiple levels:

| Artifact | Location | Purpose |
|---|---|---|
| `CONTEXT.md` | root + each package | System/package orientation. What it does, what it doesn't do, key terms. First file a fresh agent should read. |
| ADRs | `docs/adr/` | One file per major decision (immutable). Explains WHY, not just WHAT. |
| Tech specs | `docs/specs/` | Detailed HOW — DAG execution model, shader compilation pipeline, param store protocol |
| Design docs | `docs/design/` | High-level WHAT/WHY — overall system design, plugin API design, node taxonomy rationale |
| Contributing docs | `docs/contributing/` | Plugin authoring guide, node type authoring guide, dev setup |
| Usage docs | `docs/usage/` | End-user how-to: install, `createBackground` API, graph JSON format, param system |
| TSDoc | All public interfaces | Inline type-level contracts — the interfaces in `@funny-colors/core/src/types.ts` are the API surface |

## Rationale

- **CONTEXT.md per package** — scoped orientation means an agent can understand a single package without reading the whole repo
- **ADRs** — immutable records of decisions prevent re-litigating resolved choices and explain constraints that aren't obvious from the code
- **TSDoc on interfaces** — documentation lives next to the types it describes; can't drift out of sync as easily as separate doc pages
- **Layered docs** — different readers have different needs: agents need CONTEXT.md, contributors need contributing guides, end users need usage docs

## Consequences

- Every new package must ship with a `CONTEXT.md` before it is considered complete
- Every significant architectural decision must produce an ADR before implementation begins
- TSDoc is required on all exported interfaces in `@funny-colors/core/src/types.ts`
- Docs are part of the definition of done for each phase
