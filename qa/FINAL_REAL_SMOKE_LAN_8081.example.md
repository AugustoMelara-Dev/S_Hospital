# Final real smoke LAN proof

Copy this file to `qa/FINAL_REAL_SMOKE_LAN_8081.md` only after validating the
real browser workflow against the final LAN server or an explicitly approved
final-validation clone. Do not include passwords, cookies, tokens or patient
private details.

Do not rename required field labels. The production preflight validates these
exact labels.

## Environment

- Estado:
- Fecha:
- URL LAN:
- Mutaciones reales:
- Login navegacion:
- Login mutacional:
- Resultado:
- Evidence/capture reference:
- Limpieza:

## Required checks

- [ ] `/up`, `/login`, `/verify-email` and realtime config respond from the LAN URL. Result/evidence:
- [ ] Login and authenticated navigation complete without console errors. Result/evidence:
- [ ] Cashier can open cashbox, issue invoice, register payment and open receipt. Result/evidence:
- [ ] History, reprint entry point and reports load from the LAN server. Result/evidence:
- [ ] Temporary validation users are disabled or removed after the run. Result/evidence:

## Evidence

- Notes:
