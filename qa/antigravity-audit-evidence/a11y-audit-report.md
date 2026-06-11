# UX & Accessibility Audit Report - S_Hospital

## Scope
- Reviewed Critical Screens: Login, Dashboard, New Invoice, Cashier/Payments, Catalog, History, Reports, Backups, Settings, Help, Receipts, Modals.
- Validated keyboard navigation, focus management, screen-reader semantics (ARIA), and color contrast compatibility.
- Executed Playwright E2E tests and `eslint-plugin-jsx-a11y` static analysis.

## Findings

| ID | Severity | Area | File | Evidence | Impact | Repro Steps | Recommendation |
|---|---|---|---|---|---|---|---|
| A11Y-01 | P1 | Authentication / Profile | `PasswordChangeView.tsx` | Linter: `jsx-a11y/label-has-associated-control` | Screen readers will not correctly announce password fields. Clicking the label text won't focus the custom `<Input />`. | Navigate to Change Password view and use a screen reader or click the label text. | Add `htmlFor` to the `<label>` and an `id` to the `<Input />` component. |
| A11Y-02 | P1 | Forms & Modals | `CategorySheet.tsx`, `ServiceSheet.tsx`, `InvoiceCart.tsx`, `PaymentModal.tsx`, `FiscalSettingsView.tsx` | Linter: `jsx-a11y/label-has-associated-control` | Reduced usability for non-technical users as they cannot click on labels to activate fields. Impacts cashier speed and accessibility. | Open any form or modal and click on field labels. | Bind custom inputs with `id` and labels with `htmlFor`. |
| A11Y-03 | P2 | Invoice History | `InvoiceHistoryView.tsx` (Lines 386) | Linter: `jsx-a11y/click-events-have-key-events` & `no-static-element-interactions` | Backdrop elements have `onClick` to dismiss modals, but cannot be activated via Keyboard (Enter/Space) and lack semantic roles. | Open Invoice Actions dropdown/modal, try to dismiss using only keyboard without pressing Esc (e.g., tabbing to backdrop). | Add `onKeyDown` handler to the backdrop or use a semantic `<button>` instead of a `<div>`. |
| A11Y-04 | P2 | Core UI Components | `ui/card.tsx`, `ui/sheet.tsx` | Linter: `jsx-a11y/heading-has-content` | Headings without content can confuse screen reader users navigating by heading structure. | Inspect standard Cards and Sheets where `CardTitle` or `SheetTitle` are used as wrappers without text content inside. | Ensure `CardTitle` and `SheetTitle` receive valid text children, or remove them if used purely for visual spacing. |
| A11Y-05 | P3 | Sidebar Navigation | `Sidebar.tsx` | Linter: `jsx-a11y/no-redundant-roles` | Minor lint warning. Explicitly defining `role="list"` on a `<ul>` element is redundant. | Inspect `Sidebar.tsx` source code. | Remove the `role="list"` attribute from the `<ul>` element. |
| E2E-01 | P2 | E2E Testing | `e2e/rc-screens.spec.ts` | Test failed: "login screen dark theme" timed out on `Cargando sesión...`. | CI pipelines will fail intermittently on dark mode tests because authentication mocks are incomplete for this specific block. | Run `npm run e2e`. The "login screen dark theme" test fails on line 49. | Add the missing `**/api/auth/me` and `**/api/public/branding` mocks to the dark mode login test block. |
| E2E-02 | P3 | E2E Testing | `e2e/production-readiness.spec.ts` | Test failed: `expect(consoleIssues).toEqual([])` | Flaky tests due to aborted network requests (e.g., `echo-config` or `cash-sessions`). | Run `npm run e2e`. The test fails because of aborted fetch/XHRs pushed to `consoleIssues`. | Filter out `net::ERR_ABORTED` from the `consoleIssues` assertion array in Playwright tests. |

## Conclusion
The application structure is solid, but suffers from common form accessibility issues (unlinked labels) which degrade the experience for keyboard-centric cashiers and screen readers. Additionally, fixing the E2E mock coverage will stabilize the automated quality gates.
