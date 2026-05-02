# Contributing to Funny Colors

## Reporting a bug or requesting a feature

Open an issue using the appropriate template. Every new issue automatically gets the `needs-triage` label — a maintainer will review it before any work begins.

Don't start working on something that hasn't been triaged yet. The triage process exists to make sure issues are fully scoped before anyone spends time on them.

## How triage works

Every issue moves through a state machine before it's ready to work on:

```
(new issue)
     ↓
needs-triage      ← maintainer evaluates category, scope, and completeness
     ↓
needs-info        ← waiting on the reporter for more detail (returns to needs-triage once answered)
     ↓
ready-for-agent   ← fully scoped, unambiguous, can be implemented without human judgment
ready-for-human   ← requires human judgment, design decisions, or manual testing
wontfix           ← will not be actioned
```

When an issue reaches `ready-for-agent`, a maintainer posts an **agent brief** as a comment. The brief is the authoritative specification — it describes current behavior, desired behavior, key interfaces, and concrete acceptance criteria. This is what you should implement against, not just the original issue description.

If an enhancement is rejected as `wontfix`, the reasoning is recorded in `.out-of-scope/` so future requests don't relitigate the same decision.

## What needs to be in place before a feature is built

Before picking up any issue, it must have:

- [ ] One category label: `bug` or `enhancement`
- [ ] State label `ready-for-agent` or `ready-for-human`
- [ ] An agent brief comment with acceptance criteria

If any of these are missing, the issue isn't ready. Leave a comment asking for triage rather than starting work.

## Working on an issue

1. Find an issue labeled `ready-for-agent` or `ready-for-human`.
2. Read the agent brief comment — this is the spec.
3. Fork the repo and create a branch off `main`.
4. Implement against the acceptance criteria in the brief.
5. Open a pull request referencing the issue (`Closes #123`).

## Pull request expectations

- One issue per PR.
- Keep changes focused — don't bundle unrelated fixes.
- The PR description should explain what changed and why, not just what the code does.
- If your PR touches the plugin API, update any relevant docs or examples.

## Labels

### State
| Label | Meaning |
|---|---|
| `needs-triage` | Not yet reviewed by a maintainer |
| `needs-info` | Waiting on the reporter for more detail |
| `ready-for-agent` | Fully scoped, can be picked up |
| `ready-for-human` | Needs human judgment to implement |
| `wontfix` | Will not be actioned |

### Category
| Label | Meaning |
|---|---|
| `bug` | Something is broken |
| `enhancement` | New feature or improvement |
| `performance` | Slow rendering, high memory, or other perf issues |
| `plugin` | Related to the plugin system |
| `frontend` | Demo site specific |

### Community
| Label | Meaning |
|---|---|
| `good first issue` | Well-scoped, low complexity — good for first-time contributors |
| `help wanted` | Open for community pickup |
