# Security Policy

## Supported versions

Once Funny Colors reaches a stable release, this table will reflect which versions receive security fixes. Until then, only the latest code on `main` is supported.

| Version | Supported |
|---|---|
| latest (`main`) | Yes |

## Scope

Funny Colors is a client-side procedural generation library. Most security concerns will fall into one of these areas:

- **Plugin execution** — plugins run user-supplied code; a vulnerability here could allow malicious plugins to escape their expected execution context
- **Input sanitization** — malformed or adversarial input passed to the generator or a plugin
- **Demo site** — XSS, content injection, or other browser-based vulnerabilities in the interactive builder
- **Supply chain** — compromised dependencies

If you're unsure whether something qualifies, report it anyway. We'd rather triage a non-issue than miss a real one.

## Reporting a vulnerability

**Do not open a public issue.** Public disclosure before a fix is in place puts everyone using the library at risk.

Instead, report privately via one of these channels:

- **GitHub private vulnerability reporting** — use the "Report a vulnerability" button on the Security tab of this repo
- **Email** — send details to [raescheet@gmail.com](mailto:raescheet@gmail.com) with the subject line `[funny-colors] Security Vulnerability`

### What to include

The more detail you provide, the faster we can assess and fix the issue:

- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept (code sample, not a live exploit)
- The version or commit you tested against
- Any mitigations you've already identified

### What to expect

- **Acknowledgement** within 48 hours
- **Initial assessment** within 5 business days
- We'll keep you updated as we work on a fix and coordinate disclosure timing with you

We don't currently have a bug bounty program, but we'll credit you in the release notes unless you'd prefer to stay anonymous.

## Disclosure policy

We follow **coordinated disclosure**. Once a fix is ready and released, we'll publish a security advisory on GitHub describing the vulnerability, its impact, and the fix. We ask that you wait for the advisory before any public disclosure.
