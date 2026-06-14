# LAN client validation proof

Estado actual: `NO VERIFICADO`
Fase: `G - prueba fisica LAN/offline real`
Decision actual: `READY_FOR_REAL_LAN_OFFLINE_INSTALLATION_TEST`

Este archivo debe completarse desde una segunda computadora fisica en la LAN del hospital. No usar `localhost`, capturas locales, mocks, Vite, ni datos manuales invisibles.

## Environment

- Date/time: NO VERIFICADO
- Responsible person: NO VERIFICADO
- Client computer name: NO VERIFICADO
- Server IP or LAN name: NO VERIFICADO
- Server LAN URL: NO VERIFICADO
- Client browser/version: NO VERIFICADO
- User/role used: NO VERIFICADO
- Evidence/capture reference: NO VERIFICADO
- Final conclusion: NO VERIFICADO

## Required checks

- [ ] `/up` responds from the client computer. Result/evidence: NO VERIFICADO
- [ ] `/login` loads from the client computer using the server IP or LAN name. Result/evidence: NO VERIFICADO
- [ ] `/verify-email` loads the expected SPA route or documented response. Result/evidence: NO VERIFICADO
- [ ] `/assets/*.js` loads as JavaScript. Result/evidence: NO VERIFICADO
- [ ] Login completes without 419 or session-expired state. Result/evidence: NO VERIFICADO
- [ ] Navigation principal loads. Result/evidence: NO VERIFICADO
- [ ] Dashboard loads. Result/evidence: NO VERIFICADO
- [ ] Cashbox opens. Result/evidence: NO VERIFICADO
- [ ] Invoice is created with patient name. Result/evidence: NO VERIFICADO
- [ ] Payment is registered. Result/evidence: NO VERIFICADO
- [ ] Receipt preview opens. Result/evidence: NO VERIFICADO
- [ ] Invoice history and reprint work. Result/evidence: NO VERIFICADO
- [ ] Reports load. Result/evidence: NO VERIFICADO
- [ ] Backup request from UI changes from `pending` to `success`. Result/evidence: NO VERIFICADO

## Command to run from the LAN client

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 `
  -BaseUrl http://IP_DEL_SERVIDOR `
  -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md
```

## Evidence

- Screenshot/photo/log reference per step: NO VERIFICADO
- Notes: Pendiente de segunda PC fisica en LAN.
