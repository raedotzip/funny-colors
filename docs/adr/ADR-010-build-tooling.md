# ADR-010: Build Tooling — Turborepo + tsup

**Status:** Accepted  
**Date:** 2026-05-01

## Context

The monorepo needs an orchestrator that builds packages in dependency order with caching, and a fast bundler for library packages.

## Decision

- **Turborepo** orchestrates the build/test/lint pipeline across packages with local caching
- **tsup** (esbuild-based) bundles each library package — generates CJS + ESM + `.d.ts` in one command
- **Vite** handles `apps/web` separately (app tooling is distinct from library tooling)
- Plain TypeScript throughout — no additional framework

## Rationale

- `.gitignore` already excluded `.turbo` — Turborepo was the original intent
- tsup is zero-config for TypeScript libraries; esbuild is fast enough that incremental builds are effectively instant
- Keeping library and app tooling separate avoids Vite's opinionated app-first config from leaking into library bundles

## Consequences

- Each library package requires a `tsup.config.ts`
- `turbo.json` defines the task graph — build tasks depend on `^build` (upstream packages must build first)
- Turbo cache keys are based on file hashes — no manual cache invalidation needed
- Test tasks depend on `^build` to ensure type declarations are available
