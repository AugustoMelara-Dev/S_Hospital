# LAN loadtest safety

- Date: 2026-06-04
- Decision: `PRODUCTION_CANDIDATE`
- Scope: make LAN emulation and loadtest runners safe for validation without
  allowing accidental execution against the real production database.

## Safety contract

- Loadtest and LAN emulation create invoices and may register payments.
- They must run only against `validation`, `disposable` or `training` targets.
- `HOSPITAL_CONFIRM_LOADTEST_TARGET` must exactly match `BASE_URL`.
- LAN emulation must set a unique `LAN_EMULATION_RUN_ID` so the orchestrator
  rejects stale cashier result files from older runs.
- Cashier passwords must be supplied explicitly from temporary validation users.
- Docker LAN emulation must not mount `docker.sock` or use public DNS.
- These tests do not replace second-client LAN proof, physical printer proof,
  final restore proof or final supervised training acceptance.

## Files covered

- `docker-compose.lan-emulation.yml`
- `scripts/loadtest_smoke.sh`
- `qa/loadtest/fiscal-race.js`
- `qa/loadtest/multi-cashier.js`
- `qa/loadtest/README.md`
- `qa/loadtest/package.json`
- `qa/lan-emulation/cashier.js`
- `qa/lan-emulation/orchestrator.js`
- `scripts/validate_lan_loadtest_safety.ps1`
- `docs/RELEASE_CHECKLIST.md`

## Validation

```text
LAN_LOADTEST_SAFETY: YES
LAN emulation and loadtest runners require disposable/validation targets and explicit credentials.
```

Additional syntax/config checks run for this phase:

- `node --check qa\lan-emulation\cashier.js`
- `node --check qa\lan-emulation\orchestrator.js`
- `node --check qa\loadtest\fiscal-race.js`
- `node --check qa\loadtest\multi-cashier.js`
- `docker compose -f docker-compose.lan-emulation.yml --profile lan5 config --quiet` with validation-only placeholder users and a disposable `LAN_EMULATION_RUN_ID`

`bash -n scripts/loadtest_smoke.sh` was not available in this Windows environment because WSL has no installed distribution.
