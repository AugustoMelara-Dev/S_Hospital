# React Frontend Audit Report

## Execution Summary

I have audited the React frontend (`C:\Projects\S_Hospital\frontend`) focusing on React components, states, styling, testing, and offline requirements. 

- `npm run typecheck` passed without TypeScript errors.
- `npm run test` passed (239 tests) but with noisy `act(...)` warnings.
- `npm run lint` returned 6 errors and 28 warnings, revealing dependency issues, a11y violations, and misused variables.
- Code analysis showed multiple deviations from `AGENTS.md` rules regarding form handling.

## Findings Table

| ID | Severity | Area | File | Evidence | Impact | Repro Steps | Recommendation |
|---|---|---|---|---|---|---|---|
| F-01 | P1 | Forms | `src/features/admin/UsersView.tsx`<br>`src/features/settings/FiscalSettingsView.tsx`<br>`src/features/auth/PasswordChangeView.tsx` | Components use standard controlled state (e.g., `useState({ name: '', email: '' })`) and manual validation. | Violates `AGENTS.md` rule: "Usar React Hook Form + Zod para formularios." Creates inconsistent form handling across the app. | Open files and inspect `userForm` or `hospitalForm` implementations. | Refactor these views to use `useForm` from `react-hook-form` paired with a `@hookform/resolvers/zod` schema. |
| F-02 | P1 | Form Logic | `src/features/catalog/components/CategorySheet.tsx` | `<Checkbox {...register('active')} />` | `Checkbox` is a Radix UI component that emits `onCheckedChange(boolean)` instead of a standard `onChange(event)`. `register` won't capture its value correctly. | Try to toggle the checkbox in the Category form and submit. | Wrap the `Checkbox` in a RHF `<Controller>` and bind `onCheckedChange` to `field.onChange`, and `checked` to `field.value`. |
| F-03 | P2 | Hooks | `src/features/invoices/NewInvoiceView.tsx`, `App.tsx`, `UsersView.tsx`, `ReportsView.tsx` | Dozens of `react-hooks/exhaustive-deps` warnings reported by `eslint`. | Missing dependencies can cause stale closures, especially with `state` and `useCallback` functions. | Run `npm run lint`. | Include all missing dependencies in the arrays, or use `useCallback` for functions defined outside `useEffect`. |
| F-04 | P2 | Accessibility | `src/features/invoices/InvoiceHistoryView.tsx` | `<div className="fixed inset-0 z-40" onClick={() => setOpenActionsId(null)} />` | Backdrop overlay `div` lacks keyboard interaction, breaking `jsx-a11y/click-events-have-key-events`. | Run `npm run lint`. | Add `role="presentation"` or an `onKeyDown` handler to the overlay, or ignore rule if strictly visual backdrop. |
| F-05 | P2 | Accessibility | `src/components/ui/card.tsx`, `sheet.tsx` | `<h2 className={cn(...)} {...props} />` | ESLint throws `jsx-a11y/heading-has-content` because children are spread implicitly. | Run `npm run lint`. | Explicitly include `{props.children}` inside the heading tags to satisfy the linter. |
| F-06 | P3 | Testing | `src/features/reports/ReportsView.test.tsx`, `App.test.tsx` | Multiple `Warning: An update to ReportsView inside a test was not wrapped in act(...)` in test output. | State updates are occurring asynchronously outside of test assertions, which can lead to flaky tests. | Run `npm run test`. | Wrap state-triggering async actions in `waitFor` or `act` within the test suites. |

## Next Steps
Please evaluate these findings. F-01 and F-02 are critical because they violate the direct project rules and introduce bugs in component behavior. F-03 needs fixing to avoid hard-to-track React rendering bugs.
