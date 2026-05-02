---
name: Phase 2 implementation decisions
description: Non-obvious decisions made during @funny-colors/core Phase 2 implementation
type: project
---

Buffer nodes always re-evaluate every frame (same as source nodes), even when not dirtied.

**Why:** Buffer nodes are stateful — their accumulated `FrameState` changes every frame they run, so skipping them when "clean" would freeze their state. The system spec's dirty-flagging rule ("skip if clean AND not source") was amended to also exclude buffer nodes.

**How to apply:** In `DagRunner.evaluate`, the skip condition is `!alwaysEvaluate && !dirty`, where `alwaysEvaluate = isSource || isBuffer`. Phase 3+ code touching the evaluation loop must preserve this invariant.

---

Module structure: each module in its own folder with test co-located.

**Why:** User preference — "each file and its test inside of its own folder, use barreling to have an index that imports the folder."

**How to apply:** Every new module in any package should follow `module-name/index.ts` (implementation) + `module-name/module-name.test.ts` (tests). Root `src/index.ts` barrels all modules.

---

Phase 2 complete. All tests passing (47/47), coverage 96.42% branches (threshold 95%).

Files delivered:
- `packages/core/src/errors/index.ts` — CyclicGraphError, UnknownNodeError
- `packages/core/src/registry/index.ts` — NodeRegistry
- `packages/core/src/param-store/index.ts` — ParamStore
- `packages/core/src/dag/index.ts` — buildEvaluationOrder, DagRunner
- `packages/core/src/types/index.ts` — all public type interfaces (moved from flat file)
- `docs/adr/ADR-015-error-handling-standard.md` — error handling ADR
