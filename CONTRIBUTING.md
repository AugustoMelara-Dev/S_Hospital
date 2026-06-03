# Contributing to S_Hospital

Thank you for contributing to the S_Hospital cashier and billing system.
This document is the entry point for new contributors; the build, test,
and deploy commands live in `AGENTS.md` and `docs/`.

## Code of conduct

We are a small, mission-driven team: this system runs at a hospital, so
the people using it are cashiers, auditors, and treasury staff, not
"users" in the abstract. Be respectful in every interaction, in code
review, and in operator-facing copy. Keep the audit plan in
`docs/PLAN_AUDITORIA_v1.0.0.md` as the source of truth for what
"done" means, and commit atomically — one phase, one concern, one
commit. If a change does not advance an audit checkpoint, it is not
ready to merge.

## Branch policy

`main` is the only long-lived branch. Every line of work happens on a
short-lived branch named `codex/audit-<short-topic>` (for example
`codex/audit-pint-strict` or `codex/audit-ci-coverage`). Branches are
squash-merged back into `main` after CI is green and the audit
reviewer signs off.

## Commit format

We use [Conventional Commits](https://www.conventionalcommits.org/).
The full policy is mirrored in `AGENTS.md`; the short version is:

- `feat(scope): ...` for new behavior
- `fix(scope): ...` for bug fixes
- `refactor(scope): ...` for internal restructuring
- `test(scope): ...` for tests only
- `docs(scope): ...` for documentation only
- `chore(scope): ...` for tooling, build, or housekeeping
- `ops(scope): ...` for deployment, infra, and runbook changes
- `ci(scope): ...` for CI pipeline changes

Subject lines stay under 72 characters, use the imperative mood, and
reference the audit phase or ticket when one exists.

## Pull requests

Every PR uses the template at `.github/PULL_REQUEST_TEMPLATE.md`.
Fill in **What**, **Why**, **How to test**, **Screenshots**, and
**Risks** before requesting review. Screenshots are required for any
user-facing change.

## Pre-commit hook

Install the local guard with:

```powershell
.\scripts\install_dev_hooks.ps1
```

This wires `scripts/pre-commit-guard.ps1` into Git, so every commit
rejects stray secrets, missing migration files, and obvious
debug-only code before it leaves your machine.

## Quality gate

`scripts/quality_gate.sh` (PowerShell: `scripts\quality_gate.ps1`)
must pass locally before pushing. The gate runs the backend test
suite, the frontend type-check and lint, the Playwright e2e suite,
and the docker-source assertion. CI runs the same gate; if your
local run is green, the CI run will be green too.
