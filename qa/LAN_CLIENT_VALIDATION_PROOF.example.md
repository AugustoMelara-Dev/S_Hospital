# LAN client validation proof

Use this file as the template for `qa/LAN_CLIENT_VALIDATION_PROOF.md` on the final server.
Do not mark `PRODUCTION_READY` until this evidence is filled from a real second
computer on the hospital LAN.

## Environment

- Date/time:
- Server LAN URL:
- Client computer name:
- Client browser/version:
- Server IP:
- Operator:

## Required checks

- [ ] `GET /up` responds from the client computer.
- [ ] `/login` loads from the client computer using the server IP or LAN name.
- [ ] `/verify-email` loads the expected SPA route or documented response.
- [ ] At least one `/assets/*.js` file loads as JavaScript.
- [ ] Login completes without 419 or session-expired state.
- [ ] Cashbox opens.
- [ ] Invoice is created with patient name.
- [ ] Payment is registered.
- [ ] Receipt preview opens.
- [ ] Invoice history and reprint work.
- [ ] Reports load.
- [ ] Backup request from UI changes from `pending` to `success`.

## Evidence

- Screenshot path or photo reference:
- Notes:
