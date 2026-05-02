# ADR-013: Testing Strategy — Vitest, Near 100% Coverage

**Status:** Accepted  
**Date:** 2026-05-01

## Context

The project has multiple distinct testing layers — pure logic, DOM interactions, and GPU rendering — each requiring different tooling. The goal is near 100% code coverage across all layers.

## Decision

Vitest throughout, with per-layer tooling:

| Layer | Tooling | Notes |
|---|---|---|
| Math functions | Vitest + `@vitest/coverage-v8` | Pure unit tests, no setup |
| Node `evaluate` fns | Vitest | Pure unit tests, no setup |
| Core compiler (DAG → GLSL) | Vitest | Assert shader string output |
| Plugin contracts | Vitest | Type + runtime validation |
| DAG execution + dirty flagging | Vitest | Integration tests with mock nodes |
| Graph builder state/logic | Vitest + `@testing-library/dom` | DOM state assertions |
| Renderer (WebGL) | Vitest browser mode + Playwright | Real browser required for WebGL |
| Visual regression | Vitest browser mode | Screenshot diffing |

Coverage runs per-package via Turbo; reports roll up across the workspace. Each package's `test` script runs `vitest run --coverage`.

## Rationale

- **Vitest everywhere** — consistent runner, config, and coverage tooling; no context-switching between Jest and Cypress
- **Browser mode for WebGL** — WebGL is not available in Node.js; Vitest browser mode with Playwright runs tests in a real Chromium instance
- **Near 100% coverage** — the modular design (pure functions, typed interfaces) makes high coverage achievable without heroic mocking

## Consequences

- Renderer tests require Playwright to be installed and a headless browser to be available in CI
- Each package must configure `vitest.config.ts` and `@vitest/coverage-v8`
- Coverage thresholds are enforced per-package, not just at the aggregate level
