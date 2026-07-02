# Accessibility Checklist

WCAG AA checklist for S_Hospital. This is a living checklist, not a final
certification.

Status date: 2026-07-02
Production approval: NO

## Global Requirements

- [x] One visible `h1` on critical screens covered by the focused E2E gate.
- [x] `main` landmark present on authenticated critical routes.
- [x] Icon-only buttons use text or `aria-label`.
- [x] Decorative icons use `aria-hidden="true"`.
- [x] Dialogs use Radix primitives with focus trap and accessible names.
- [x] Alerts and validation errors use semantic roles where implemented.
- [x] Data tables expose captions/container labels in the shared table wrapper.
- [x] Critical route controls are checked for accessible names by Playwright.
- [x] Serious/critical axe-core violations are blocked in the focused E2E gate.

## Focused Automated Evidence

Command:

```bash
cd frontend
npx playwright test e2e/accessibility.spec.ts
```

Latest recorded result: PASS, 2 tests on 2026-07-02.

Coverage:

- `/login`
  - single accessible `h1`;
  - username and password labels;
  - password visibility button name;
  - submit button name;
  - no serious/critical axe violations;
  - no visible unnamed controls.
- Authenticated critical routes:
  - `/dashboard`;
  - `/billing/new`;
  - `/cashbox`;
  - `/catalog`;
  - `/invoices`;
  - `/reports/executive`;
  - `/backups`;
  - `/settings/fiscal`;
  - `/admin/users`.

For each protected route the test checks:

- `main` landmark visible;
- exactly one level-one heading;
- no visible unnamed controls;
- no serious/critical axe-core violations.

## Manual Keyboard QA Still Required

- [ ] First Tab exposes and activates the skip link to `#main-content`.
- [ ] Sidebar collapse exposes correct `aria-expanded` and `aria-controls`.
- [ ] New invoice can be completed by keyboard, including `Ctrl+Enter`.
- [ ] Cash close wizard can be completed by keyboard.
- [ ] ActionMenu rows in catalog/history/users are reachable by keyboard.
- [ ] Dialog Escape behavior is safe and does not trigger destructive actions.
- [ ] Focus returns to the invoking control after dialogs close.
- [ ] Browser zoom 125% has no page-level horizontal scroll on critical routes.

## Remaining Final QA Items

- Full Playwright accessibility matrix across desktop/mobile viewports.
- Real browser contrast review for light/dark mode.
- Print/PDF accessibility is out of scope for axe and requires manual review.
- Hardware-assisted keyboard review on the actual LAN workstation.

## Current Conclusion

The focused automated accessibility gates are green for the covered critical
routes. Final accessibility acceptance still requires the manual keyboard,
zoom/responsive, and real-workstation checks above.
