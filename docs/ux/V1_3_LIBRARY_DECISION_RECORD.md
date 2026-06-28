# V1.3 Library Decision Record

Status: initial decision record; update whenever dependencies change.

## Current Dependency Position

No new dependency has been added in V1.3 yet.

Baseline frontend audit:

- `npm ci`: PASS, 0 vulnerabilities.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run test`: PASS, 487 tests.
- `npm run build`: PASS.
- Build watch item: `charts` 398.35 kB, `vendor` 348.15 kB.

## Candidates

| Library | Decision | Reason | Bundle/Offline Impact | Tests Required |
| --- | --- | --- | --- | --- |
| `@tanstack/react-table` | EVALUATE SERIOUSLY | Strong fit for reports, invoice history, users, catalog, backups; shadcn data table pattern uses it. | Adds table core but may reduce custom table complexity. | Table unit tests, report/history/admin flows, build size. |
| `@tanstack/react-virtual` | DEFER | Use only if measured table sizes show rendering pressure. | Avoid extra runtime unless evidence requires it. | Large-table rendering test, performance review. |
| `cmdk` | DEFER | Command palette may improve global navigation, but POS first actions may be enough. | Small but not free; must not distract cashiers. | Keyboard/a11y tests, navigation E2E. |
| `react-aria-components` | DEFER | Useful for complex a11y components only when Radix wrappers are insufficient. | Larger design/API surface. | A11y tests for specific component. |
| `ariakit` | DEFER | Same category as React Aria; do not duplicate primitives without need. | Extra primitive system risk. | A11y tests for specific component. |
| `date-fns` | DEFER | Add only if current date/range handling is error-prone. | Usually manageable, but unnecessary if native helpers suffice. | Date range tests, report filter tests. |
| `Recharts` | KEEP | Already installed and used; avoid chart suite migration. | Existing largest chart chunk requires lazy/performance review. | Chart tests, responsive visual smoke. |
| `shadcn/ui` | USE AS PATTERN | Existing local wrappers and Radix fit this stack. | Copy code patterns, no runtime SaaS dependency. | Component tests and a11y. |

## Rejected By Policy Unless New Evidence Appears

- MUI
- Ant Design
- Chakra
- Bootstrap
- Heavy animation libraries
- Alternative heavy chart suites

## Dependency Addition Rule

If V1.3 adds a dependency:

1. Record why current code cannot solve the problem safely.
2. Run `npm install <package>`.
3. Run `npm audit`.
4. Run `npm run typecheck`.
5. Run `npm run lint`.
6. Run `npm run test`.
7. Run `npm run build`.
8. Document bundle impact here and in `docs/qa/V1_3_PERFORMANCE_LAN_REVIEW.md`.
