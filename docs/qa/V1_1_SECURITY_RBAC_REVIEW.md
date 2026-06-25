# V1.1 Security And RBAC Review

Branch reviewed: `origin/codex/v1-1-production-polish`
Review branch: `codex/v1-1-polish-review`
Date: 2026-06-25
Decision: PASS for internal merge
Physical production approved: NO

## Scope

This review checks that the V1.1 polish work did not weaken authorization, expose secrets, introduce unsafe frontend sinks, or create a privacy regression. It is a repository and automated-test review only; it does not approve physical production.

## Required Search

Required command:

```powershell
git grep -n "dangerouslySetInnerHTML|innerHTML|console.log|localStorage|sessionStorage|password|token|secret|stack trace|SQLSTATE" -- frontend/src backend/app
```

Result: no matches with the literal basic-regex command.

Extended command used to classify actual matches:

```powershell
git grep -n -E "dangerouslySetInnerHTML|innerHTML|console\.log|localStorage|sessionStorage|password|token|secret|stack trace|SQLSTATE" -- frontend/src backend/app
```

Classification:

| Area | Finding | Classification |
| --- | --- | --- |
| Frontend XSS sinks | No `dangerouslySetInnerHTML` in `frontend/src`; test-only `document.body.innerHTML` exists outside production code. | PASS |
| Frontend console | No `console.log` in `frontend/src` from this grep. | PASS |
| Frontend storage | `localStorage` is used for non-secret theme/tour preferences and sanitized client issue logs. Session storage is cleared on auth transitions. | PASS with low residual browser-storage risk |
| Auth/password | Password fields flow through login/change/reset APIs; backend hashes passwords, enforces 12-character mixed policy, and does not return password hashes. | PASS |
| Token/secret strings | Matches are sanitizer code, CSRF comments/tests, model hidden fields, backup redaction, and support log redaction. | PASS |
| Stack trace/SQLSTATE | Matches are sanitizers and tests verifying SQLSTATE/paths/secrets are not displayed. | PASS |
| Legal/institutional defaults | Legacy receipt/report code still contains fallback government/secretariat strings that predate this review diff; the principal institutional receipt snapshot uses configured or invoice snapshot values without inventing new lines. | Warning, not merge blocker |

## RBAC Review

Frontend route gating:

- `frontend/src/navigation/appNavigation.ts` declares route-level permissions for billing, cashbox, catalog, invoices, reports, backups, fiscal settings, receipt settings, and users.
- `frontend/src/AppRoutes.tsx` wraps protected routes with `PermissionGate`.
- This is UX guidance only; it is not treated as the security boundary.

Backend enforcement:

- API routes are behind `web`, `auth:web`, `user.active`, and `password.changed` where appropriate.
- Sensitive actions use Form Requests, Gates/Policies, and action-level operational checks.
- Invoices and payments keep operational scope checks through `InvoicePolicy`, `InvoiceAccess`, `PaymentController`, and receipt PDF access logic.
- Backups require `backups.view`, `backups.create`, and `backups.download`; downloads validate status, disk, safe relative path, backup root containment, filename, and audit events.
- Admin users require `users.*` permissions and protect role assignment, direct permissions, self-role/self-permission changes, and self password reset.
- Reports enforce managerial, cash-session, export, and ownership restrictions in request classes.

## Tests Used As Evidence

- `npm run test:e2e`: passed 2/2 release specs, including admin creation of a catalog-only user and navigation/RBAC denial for unauthorized modules.
- MariaDB focal: passed 71 tests / 614 assertions covering `InstitutionalReceiptPdfTest`, `CashPaymentsReceiptTest`, and `UserManagementTest`.
- Backend partial Docker evidence: exit code 0, 49 passed, 668 warning-class outcomes, 1 skipped, 4672 assertions.
- Final post-merge backend gate: PASS, exit code 0, 707 passed, 11 skipped, 4672 assertions.
- Frontend unit/component suite: 82 files / 487 tests passed, including sanitizer and access-denied coverage.
- Full a11y matrix: 7/7 passed, including denied route and dialog cancel path.

## Findings

No Critical, High, P0, or P1 security/RBAC blocker was found for internal merge.

Warnings:

- Browser `localStorage` is used for non-secret client issue logs and preferences. Sanitizers are present and tests verify secrets/paths/SQLSTATE are removed, but browser storage remains user-accessible by nature.
- Legacy receipt/report code contains default government/secretariat fallback strings. This review did not introduce them, and the institutional receipt path uses configured/snapshot values, but future cleanup should remove or gate legacy fallbacks to avoid legal-text ambiguity.
- Security headers/CSP enforcement for the final LAN deployment should be verified at runtime/reverse proxy during physical acceptance.

## Decision

PASS for internal merge. Physical production remains not approved until second-PC LAN, printer, restore, and load evidence are complete.
