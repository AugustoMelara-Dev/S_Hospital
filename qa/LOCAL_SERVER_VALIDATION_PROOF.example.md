# Local server validation proof

Use this file only for the approved single-machine S_Hospital installation mode where the same computer runs the app, MySQL/MariaDB and the browser used by the cashier/admin.

## Environment

- Date/time: TODO
- Responsible person: TODO
- Server computer name: TODO
- Local app URL: http://127.0.0.1:TODO
- Browser/version: TODO
- User/role used: TODO
- Evidence/capture reference: qa/evidence/local-server-YYYY-MM-DD
- Final conclusion: TODO

## Required checks

- [ ] `/up` responds on the server computer. Result/evidence: TODO
- [ ] `/login` loads on the server computer. Result/evidence: TODO
- [ ] `/verify-email` loads the expected SPA route or documented response. Result/evidence: TODO
- [ ] `/assets/*.js` loads as JavaScript from the local server. Result/evidence: TODO
- [ ] Login completes without 419 or session-expired state. Result/evidence: TODO
- [ ] Cashbox opens. Result/evidence: TODO
- [ ] Invoice is created with patient name. Result/evidence: TODO
- [ ] Payment is registered. Result/evidence: TODO
- [ ] Receipt preview opens. Result/evidence: TODO
- [ ] Invoice history and reprint work. Result/evidence: TODO
- [ ] Reports load. Result/evidence: TODO
- [ ] Backup request from UI changes from `pending` to `success`. Result/evidence: TODO

## Evidence

- Screenshot/photo/log reference per step: qa/evidence/local-server-YYYY-MM-DD/*.png
- Notes: TODO
