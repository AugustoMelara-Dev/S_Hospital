# S_Hospital V1.1 - Local Field Acceptance Checks

Date: 2026-06-25 America/Tegucigalpa
Branch: `codex/field-acceptance-execution-log`
SHA tested: `bfa115f15f613a69e81e54a462a5c0e7c9e40f69`

## Repository state

Manual Git verification before editing the execution log:

- Branch: `main`.
- `main`: `bfa115f15f613a69e81e54a462a5c0e7c9e40f69`.
- `origin/main`: `bfa115f15f613a69e81e54a462a5c0e7c9e40f69`.
- Status before creating the log branch: clean.

The execution log was then prepared on `codex/field-acceptance-execution-log`.

## Server and LAN self-check

Detected server/workstation:

- Hostname: `AugustoMelara`.
- LAN IPv4: `192.168.1.10`.
- Gateway: `192.168.1.1`.

Docker services observed:

- `shospital_offlinetest-nginx-1`: healthy, `0.0.0.0:8081->80/tcp`.
- `shospital_prodtest-nginx-1`: healthy, `0.0.0.0:8080->80/tcp`.
- `s_hospital_f7_verify-nginx-1`: healthy, `0.0.0.0:18080->80/tcp`.

Safe URL checks:

- `http://127.0.0.1:8080`: HTTP 200.
- `http://127.0.0.1:8081`: HTTP 200.
- `http://127.0.0.1:18080`: HTTP 200.
- `http://192.168.1.10:8080`: PASS for `/`, `/login`, `/api/health`, `/api/system/health`, `/api/system/setup-status`.
- `http://192.168.1.10:8081`: PASS for `/`, `/login`, `/api/health`, `/api/system/health`, `/api/system/setup-status`.

Health observations:

- `8080` and `8081` reported MySQL connected.
- `8080` and `8081` reported `backup_worker_idle`.
- `18080` also reported backup failures in the last 24 hours and was not selected as the preferred field URL.

## Script checks

- `scripts/qa/check-lan-url.ps1 -Url "http://192.168.1.10:8081"`: PASS after adding `Url` alias.
- `scripts/qa/check-lan-url.ps1 -Url "http://192.168.1.10:8080"`: PASS after adding `Url` alias.
- `scripts/qa/check-main-state.ps1`: corrected to use current expected SHA and reliable Git argument handling. Post-commit verification passed with `main` and `origin/main` at `bfa115f15f613a69e81e54a462a5c0e7c9e40f69`.
- PowerShell syntax parse: PASS for all three QA scripts.

## Physical gates

The following were not executed in this session because the required external equipment/operator was not available:

- Second real PC on LAN.
- PC1/PC2 synchronization workflow.
- Physical printer output.
- Disposable backup/restore run.
- Real LAN load/concurrency run.

Physical production approval remains NO.
