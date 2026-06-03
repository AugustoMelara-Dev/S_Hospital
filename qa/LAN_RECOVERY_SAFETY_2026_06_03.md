# LAN recovery safety evidence - 2026-06-03

Decision: `PASS`.

Scope:

- Verify that `scripts\refresh_lan_ip.ps1` uses the real shared helper libraries instead of removed legacy helper paths.
- Verify that the LAN recovery flow previews safely with `-WhatIf` before changing `.env`, firewall or Docker services.
- Verify that support and installation guides document what to do when DHCP, router changes or NIC changes move the server IP.

Command run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate_lan_recovery_safety.ps1
```

Observed result:

- `LAN_RECOVERY_SAFETY: YES`.
- `refresh_lan_ip.ps1` imports `scripts\lib\env_helpers.ps1` and `scripts\lib\net_diagnostics.ps1`.
- `scripts\lib\net_diagnostics.ps1` uses `Get-NetRoute` and route metrics to
  prefer the active LAN path when multiple adapters are present.
- `refresh_lan_ip.ps1` updates `SERVER_IP`, `APP_URL`, `SANCTUM_STATEFUL_DOMAINS` and `CORS_ALLOWED_ORIGINS` through the ASCII-safe env helper.
- A disposable fixture confirmed `-WhatIf` exits successfully and does not modify root or backend `.env` files.
- The manuals tell staff not to invoice from client computers while LAN access is down and require validation from a second client after refresh.

Safety notes:

- This was a local guard and disposable-fixture test only.
- No real `.env`, database volume, backup SQL or production data was changed.
- Final delivery still requires `qa\LAN_CLIENT_VALIDATION_PROOF.md` from a second computer on the installed hospital LAN.
