# ADR-015: Error Handling Standard — Named Error Classes with Stable Codes

**Status:** Accepted  
**Date:** 2026-05-02

## Context

`funny-colors` is a library consumed by third-party developers. How it signals failure shapes the DX of every user. We needed a consistent, machine-readable, and TypeScript-friendly error contract that works across all packages without introducing dependencies.

Three options were evaluated:

| Option | Description | Tradeoff |
|---|---|---|
| A | Plain `Error` throws | No structure — callers can't distinguish errors without string-matching `.message` |
| B | Result types (`neverthrow` / `fp-ts`) | Typed, composable — but alien to most JS/TS developers and adds a runtime dependency |
| C | Named `Error` subclasses with stable codes | Idiomatic JS, `instanceof`-checkable, zero dependencies, carries structured fields |

## Decision

**Option C.** All errors thrown by any `funny-colors` package are named classes that extend `Error` and carry a machine-readable `code` string.

### Error class contract

Every error class must satisfy this shape:

```ts
class SomeError extends Error {
  /** Stable, machine-readable identifier. Never changes across patch/minor versions. */
  readonly code: 'SOME_ERROR'

  constructor(/* context args */) {
    super('Human-readable message describing what went wrong and why.')
    this.name = 'SomeError'   // must match class name exactly
    // additional context fields declared on the class
  }
}
```

Rules:
- `name` is always set explicitly in the constructor so it survives minification
- `code` is a `const` string literal type — callers can narrow on it without `instanceof`
- `message` is always human-readable English, suitable for logging to a console
- Additional context fields (e.g. `definitionId`, `stage`) are declared as `readonly` class members
- Codes use `SCREAMING_SNAKE_CASE`
- Class names use `PascalCase` and always end in `Error`

### Export requirement

Every error class is exported from the root `index.ts` of its package. End users must be able to import them directly:

```ts
import { CyclicGraphError, UnknownNodeError } from '@funny-colors/core'
import { WebGLNotSupportedError, ShaderCompileError } from '@funny-colors/renderer'
import { UnsupportedConfigVersionError } from 'funny-colors'
```

### When to throw vs. when not to

| Situation | Behaviour |
|---|---|
| Unrecoverable state detected **before** the animation loop starts (startup path) | Throw synchronously |
| Invalid operation that is safely ignorable (e.g. `setParam` with an undeclared key) | Silent no-op |
| Error occurring **inside** the animation loop (frame evaluation) | Catch internally; surface via `BackgroundInstance.onError` callback (Phase 5) |
| Programmer error in plugin code (wrong port type, non-pure evaluate) | Throw — fail fast during development |

The startup / runtime boundary is `createBackground()`. Any throw after the first `requestAnimationFrame` fires must not propagate to user code uncaught.

### TSDoc on every throw site

Every function that throws must document it:

```ts
/**
 * @throws {CyclicGraphError} When the graph contains a directed cycle.
 * @throws {UnknownNodeError} When a node references an unregistered `definitionId`.
 */
```

## Rationale

- **Named classes** allow `instanceof` narrowing — the most ergonomic pattern in TypeScript
- **`code` field** gives machine consumers a stable discriminant that survives refactors to `.message`
- **No Result type** — rendering libraries (Three.js, PixiJS, Babylon.js) universally use thrown errors; deviating would surprise the target audience
- **`name` = class name** ensures stack traces are readable even after bundler minification
- **Silent no-ops** for non-critical misuse avoids crashing production pages over typos in param names

## Consequences

- All packages follow the same pattern — `errors.ts` per package, exported at root
- New error types require: a class in `errors.ts`, an export in `index.ts`, a `@throws` tag at every throw site, an entry in the system-spec error catalogue
- Breaking: renaming a `code` string or removing an error class requires a major version bump
- `@funny-colors/core` defines `CyclicGraphError` and `UnknownNodeError`
- `@funny-colors/renderer` defines `WebGLNotSupportedError` and `ShaderCompileError`
- `funny-colors` (public package) defines `UnsupportedConfigVersionError`
