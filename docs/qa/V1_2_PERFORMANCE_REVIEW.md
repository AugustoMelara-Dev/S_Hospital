# V1.2 Performance Review

Date: 2026-06-28
Branch: codex/v1-2-visible-ui-delta

## Dependency Decision

No new frontend runtime libraries were added for V1.2. The refactor uses the existing React, TypeScript, Tailwind v4 tokens, Radix-style primitives/components, Recharts, TanStack Query, React Hook Form, Zod, Vitest, and Playwright stack.

Rejected for this phase:
- Framer Motion: no operational need for heavier animation in cashier workflows.
- Additional chart library: Recharts remains sufficient.
- Heavy date picker: existing controls are adequate.
- Sonner/toast replacement: current notification surface remains sufficient.
- TanStack Table: deferred; current tables were improved with local components without adding bundle cost.

## Build Output

Command: npm run build
Result: PASS

Largest emitted chunks from the final build:
- charts-JUI4aW6N.js: 398.35 kB, gzip 114.67 kB
- vendor-Txi_p2nM.js: 348.15 kB, gzip 109.28 kB
- index-DtnyDoof.js: 222.07 kB, gzip 55.00 kB
- ui-B0p8LjPE.js: 160.90 kB, gzip 48.91 kB
- ReportsView-CyK9tDaM.js: 103.02 kB, gzip 20.53 kB
- forms-ditSlwIx.js: 97.64 kB, gzip 28.64 kB

The V1.2 work keeps major route chunks lazy-loaded and does not introduce new heavy vendor chunks.

## Runtime Risk Review

Dashboard and reports remain the heaviest UI areas because they use Recharts. They already render through route chunks and accessible chart wrappers. The final a11y matrix did not report global overflow across 320x640, 375x667, 768x1024, 1024x768, 1366x768, or 1920x1080.

POS and cashbox changes are presentational and use existing state/reducer/API flows. No money/tax/payment/cashbox logic was changed.

## Gates

- npm audit: PASS, 0 vulnerabilities
- npm run typecheck: PASS
- npm run lint: PASS
- npm run test:full:windows: PASS, 83 files / 494 tests
- npm run build: PASS
- npm run smoke:buttons: PASS, 7 tests
- npx playwright test e2e/v1-2-visible-ui-a11y.spec.ts: PASS, 7 tests
- npx playwright test e2e/production-readiness.spec.ts: PASS, 4 tests with after screenshots
- npm run test:e2e: PASS, 2 release tests

## Result

Performance review: PASS
New heavy dependencies: NONE
Bundle risk: ACCEPTABLE for V1.2 review
Production physical approval: NO