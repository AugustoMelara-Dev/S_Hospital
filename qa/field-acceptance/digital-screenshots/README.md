# Digital Screenshot Evidence

Date: 2026-06-25
Branch: `codex/field-acceptance-prep`
Verified SHA: `ebc9018102b1940ebe8ba9b5bfd3107a2ef4b122`

## Status

Evidence generated with limits.

- Official release E2E log: `release-e2e-capture.log` - PASS, 2 tests.
- Mocked visual capture log: `production-readiness-capture-5175.log` - 3 passed, 1 timed out while selecting A5 receipt option.
- Mocked capture report: `rc-e2e-mocked-report.json`.
- PNG files in this directory are local mocked UI screenshots. They are useful for field packet review, but they do not replace physical LAN, printer, restore or load acceptance.

## PNG evidence files

- `login-light.png`
- `login-dark.png`
- `dashboard-light.png`
- `dashboard-dark.png`
- `billing-new-empty-light.png`
- `billing-new-cart-light.png`
- `payment-modal-light.png`
- `invoice-confirmation-light.png`
- `receipt-preview-light.png`
- `cashbox-open-light.png`
- `cashbox-close-dialog-light.png`
- `access-denied-reports-light.png`
- `not-found-light.png`
- `mobile-billing-light.png`
- `mobile-dashboard-light.png`
- `mobile-reports-access-denied-light.png`
- `mobile-reports-admin-light.png`

## Acceptance note

The digital release gate is PASS based on the official `npm run test:e2e` execution. The mocked screenshots are supplementary evidence only. Physical production approval remains NO.
