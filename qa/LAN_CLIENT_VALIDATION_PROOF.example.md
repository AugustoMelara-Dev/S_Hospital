# LAN client validation proof

Copy this file to `qa/LAN_CLIENT_VALIDATION_PROOF.md` on the final server,
delete this instruction block, and fill every required field below from a real
second computer on the hospital LAN. Do not mark `PRODUCTION_READY` until this
evidence is complete.

Do not rename required field labels. The production preflight validates these
exact labels and the checked items below.

## Environment

- Date/time:
- Responsible person:
- Client computer name:
- Server IP or LAN name:
- Server LAN URL:
- Client browser/version:
- User/role used:
- Evidence/capture reference:
- Final conclusion:

## Required checks

- [ ] `/up` responds from the client computer. Result/evidence:
- [ ] `/login` loads from the client computer using the server IP or LAN name. Result/evidence:
- [ ] `/verify-email` loads the expected SPA route or documented response. Result/evidence:
- [ ] `/assets/*.js` loads as JavaScript. Result/evidence:
- [ ] Login completes without 419 or session-expired state. Result/evidence:
- [ ] Cashbox opens. Result/evidence:
- [ ] Invoice is created with patient name. Result/evidence:
- [ ] Payment is registered. Result/evidence:
- [ ] Receipt preview opens. Result/evidence:
- [ ] Invoice history and reprint work. Result/evidence:
- [ ] Reports load. Result/evidence:
- [ ] Backup request from UI changes from `pending` to `success`. Result/evidence:

## Evidence

- Screenshot/photo/log reference per step:
- Notes:
