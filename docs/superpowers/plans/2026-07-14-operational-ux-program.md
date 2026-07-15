# S_Hospital Operational UX Correction Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute the approved evidence-led operational redesign without mixing independent subsystems or losing any acceptance criterion.

**Architecture:** Five independently testable plans run in dependency order. Baseline instrumentation is shared by every later plan; core, grids, and administration may proceed only after its fixture contract exists; document/release closure runs after all feature plans and audits every requirement against fresh evidence.

**Tech Stack:** React, TypeScript, Ant Design, Ant Design Icons, AG Grid Community, Apache ECharts, React Hook Form, Zod, TanStack Query, Day.js, Laravel, MySQL/MariaDB, Vitest, Storybook, Playwright, axe.

## Global Constraints

- The authoritative design is `docs/superpowers/specs/2026-07-14-operational-ux-correction-design.md`.
- Production remains fully offline on LAN; no CDN, mandatory SaaS, or remote runtime assets.
- Preserve fiscal, permission, audit, transaction, idempotency, API, and historical snapshot contracts.
- Keep global `borderRadius: 0` and the required visual libraries.
- Never increase timeouts to hide latency or accept tests as the sole visual evidence.
- Use Conventional Commits; one coherent subsystem change per commit.

---

## Execution Order

- [ ] **Phase 1: Establish baseline and critical LAN performance**

Execute every task in [2026-07-14-operational-ux-baseline-performance.md](./2026-07-14-operational-ux-baseline-performance.md). Exit criterion: immutable baseline artifacts exist, request duplication is measured, critical endpoints are below two seconds, and all remaining UI failures are assigned to a later phase.

- [ ] **Phase 2: Correct the operational core**

Execute every task in [2026-07-14-operational-core-shell-billing.md](./2026-07-14-operational-core-shell-billing.md). Exit criterion: login, partial Dashboard, shell, billing, and payment pass component, axe, geometry, keyboard, and required viewport checks.

- [ ] **Phase 3: Correct grids and operational records**

Execute every task in [2026-07-14-operational-grids-cash-catalog.md](./2026-07-14-operational-grids-cash-catalog.md). Exit criterion: history, cash, and catalog use one localized paginator, responsive lists, accessible actions, and no document overflow.

- [ ] **Phase 4: Correct administration and identity**

Execute every task in [2026-07-14-operational-admin-settings.md](./2026-07-14-operational-admin-settings.md). Exit criterion: identity is verified or explicitly provisional; settings, users, reports, and backups expose their primary task in the first viewport.

- [ ] **Phase 5: Close documents and release evidence**

Execute every task in [2026-07-14-operational-documents-release-closure.md](./2026-07-14-operational-documents-release-closure.md). Exit criterion: primary receipts fit one page, thermal layouts are independent, the canonical twelve comparisons are superior, every completion-matrix row has authoritative evidence, and all quality gates pass.

## Requirement Coverage

| Objective section | Authoritative plan |
|---|---|
| Phase 1 — reproduce and investigate | Baseline and LAN performance |
| Phase 2 — institutional identity | Administration and settings |
| Phase 3 — shell | Operational core |
| Phase 4 — billing | Operational core |
| Phase 5 — payment | Operational core |
| Phase 6 — invoice and receipt | Documents and release closure |
| Phase 7 — history and grids | Grids, cashbox, and catalog |
| Phase 8 — cashbox | Grids, cashbox, and catalog |
| Phase 9 — catalog | Grids, cashbox, and catalog |
| Phase 10 — settings | Administration and settings |
| Phase 11 — login/network states | Baseline plus operational core |
| Mandatory tests and acceptance criteria | Every phase gate plus documents/release closure |

## Program Review Rules

After each phase, inspect the worktree, focused test output, browser artifacts,
and phase review document before starting the next plan. A later phase must not
rewrite or weaken a passing invariant from an earlier phase. If a test proves a
narrower claim than the objective, retain the requirement as open and gather
stronger evidence.

The program finishes only after the full completion matrix is green. Missing
physical LAN or printer evidence is reported honestly and cannot be replaced by
mocked E2E output.
