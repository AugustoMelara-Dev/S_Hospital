# S_Hospital V1.1 - Site Field Acceptance Run Sheet

Use this sheet during the physical hospital acceptance session. Fill it with synthetic data only. Do not record passwords, tokens, `.env` values, real patient data, real fiscal numbers not already configured, or production database credentials.

Tested software SHA: `bfa115f15f613a69e81e54a462a5c0e7c9e40f69`
Production physical approval before this run: NO
Production tag before this run: NO

## Session header

| Field | Value |
| --- | --- |
| Date/time | |
| Technical responsible person | |
| Hospital operator | |
| Server PC hostname | |
| Server LAN IP | |
| App LAN URL | |
| Browser/version | |
| Client PC 1 | |
| Client PC 2 | |
| Printer model | |
| Printer driver/profile | |
| Network name/VLAN if known | |

## Preflight

Run from the repository root on the server PC:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/qa/check-main-state.ps1
powershell -ExecutionPolicy Bypass -File scripts/qa/check-lan-url.ps1 -Url "<LAN_URL>"
```

| Check | PASS / FAIL / N/A | Evidence / notes |
| --- | --- | --- |
| `main` SHA matches expected | | |
| `origin/main` SHA matches expected | | |
| Git state acceptable | | |
| Docker/local stack running | | |
| LAN URL responds from server | | |
| No firewall change needed | | |
| Firewall change documented if needed | | |

## Gate 1 - Second PC LAN

| Check | PASS / FAIL / N/A | Evidence / notes |
| --- | --- | --- |
| Second physical PC opens LAN URL | | |
| Login works without internet | | |
| Dashboard opens | | |
| New invoice opens | | |
| Cashbox opens | | |
| Invoice history opens | | |
| Reports open when authorized | | |
| Backups/users/settings blocked or allowed according to role | | |
| Restricted user is denied correctly | | |
| Logout works | | |
| No unexpected 500 or white screen | | |

Result: `PASS / FAIL / PENDIENTE`

## Gate 2 - PC1/PC2 synchronization

Synthetic patient name used: `Paciente Validacion Campo`

| Check | PASS / FAIL / N/A | Evidence / notes |
| --- | --- | --- |
| PC1 opens cashbox with cashier user | | |
| PC1 creates synthetic invoice | | |
| PC1 adds service | | |
| PC1 collects payment | | |
| PC1 opens receipt/PDF | | |
| PC2 dashboard reflects transaction | | |
| PC2 invoice history shows transaction | | |
| PC2 cashbox/movement view is consistent with permissions | | |
| PC2 reports include transaction after refresh | | |
| No duplicate invoice/payment/movement/receipt | | |
| No unauthorized cross-cashier data exposure | | |
| No unexpected 500 or white screen | | |

Result: `PASS / FAIL / PENDIENTE`

## Gate 3 - Physical printing

Run if useful:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/qa/print-proof-checklist.ps1
```

| Format | Hardware available | PASS / FAIL / PENDIENTE | Evidence / notes |
| --- | --- | --- | --- |
| Letter | | | |
| Half-letter | | | |
| A5 | | | |
| 80mm | | | |
| 58mm | | | |

Required observations:

| Check | PASS / FAIL / N/A | Evidence / notes |
| --- | --- | --- |
| Margins acceptable | | |
| Orientation correct | | |
| Text sharp | | |
| Header visible | | |
| Item table readable | | |
| Totals stay together | | |
| Page breaks do not cut important content | | |
| Grayscale legible | | |
| No unauthorized QR code | | |
| No unauthorized barcode | | |
| No internal IDs/logs/technical codes visible | | |
| No real patient data in print evidence | | |

Result: `PASS / FAIL / PENDIENTE`

## Gate 4 - Disposable backup/restore

Never restore over production.

| Check | PASS / FAIL / N/A | Evidence / notes |
| --- | --- | --- |
| Disposable source database/stack created | | |
| Synthetic data created | | |
| Backup generated through approved flow | | |
| Backup filename recorded | | |
| Backup size recorded | | |
| Backup checksum recorded if available | | |
| Disposable source destroyed or isolated | | |
| Separate disposable restore target created | | |
| Restore completed into disposable target | | |
| Critical table counts compared | | |
| App reads restored data | | |
| Login works against restored target | | |
| History/receipt/reports/users roles verified | | |
| Disposable resources cleaned up | | |

Result: `PASS / FAIL / PENDIENTE`

## Gate 5 - Real LAN load/concurrency

Minimum expected field duration: 15-30 minutes if the operator allows it.

| Metric | Value |
| --- | --- |
| Number of physical clients | |
| Start time | |
| End time | |
| Approximate operations performed | |
| Highest observed latency | |
| Timeouts | |
| Unexpected 500s | |
| Duplicates | |
| Deadlocks | |
| Final system state | |

| Check | PASS / FAIL / N/A | Evidence / notes |
| --- | --- | --- |
| Repeated invoice creation | | |
| Repeated payment collection | | |
| Receipt reprint | | |
| Reports opened during activity | | |
| Cashbox consulted during activity | | |
| History searched during activity | | |
| Overlapping actions from different clients | | |
| Rapid double payment attempt rejected safely if tested | | |
| Double cash-open attempt rejected safely if tested | | |
| Brief LAN reconnect recovers if tested | | |
| No duplicate payment or receipt numbers | | |
| No corruption or unusable final state | | |

Result: `PASS / FAIL / PENDIENTE`

## Stop conditions

Stop field approval and open a defect if any of these occur:

- Duplicate paid invoice, payment, cash movement, or receipt number.
- Unauthorized role can access reports, backups, users, or void actions.
- Restore target is production or uncertain.
- Receipt exposes unauthorized QR, barcode, internal IDs, logs, or technical codes.
- Real patient data appears in screenshots, photos, or print evidence.
- App requires internet for login, billing, reports, or printing.
- Unexpected 500, white screen, or database corruption during a critical workflow.

## Final decision

| Decision field | Value |
| --- | --- |
| Second PC LAN | `PASS / FAIL / PENDIENTE` |
| PC1/PC2 sync | `PASS / FAIL / PENDIENTE` |
| Physical printing | `PASS / FAIL / PENDIENTE` |
| Disposable backup/restore | `PASS / FAIL / PENDIENTE` |
| Real LAN load/concurrency | `PASS / FAIL / PENDIENTE` |
| Bugs P0/P1 open | `YES / NO` |
| Production physical approval | `YES / NO` |
| Production tag created | `NO` |
| Responsible signature | |

If any required physical gate is not PASS, production physical approval remains NO.
