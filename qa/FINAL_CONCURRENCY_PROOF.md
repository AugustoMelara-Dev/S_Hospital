# Final concurrency proof

Estado actual: `NO VERIFICADO`
Fase: `G - prueba fisica LAN/offline real`
Decision actual: `READY_FOR_REAL_LAN_OFFLINE_INSTALLATION_TEST`

Este archivo documenta la validacion final de concurrencia contra una base descartable o snapshot aprobado del entorno final. El script crea datos auditables; no ejecutarlo contra produccion activa sin snapshot, ventana de mantenimiento y confirmacion explicita.

## Environment

- Date/time: NO VERIFICADO
- Responsible person: NO VERIFICADO
- Server LAN URL: NO VERIFICADO
- Target environment: NO VERIFICADO
- Run ID: NO VERIFICADO
- Evidence/capture reference: NO VERIFICADO
- Final conclusion: NO VERIFICADO

## Required checks

- [ ] Double cash-session open leaves one truth. Expected result: one open session or controlled validation error. Actual result/evidence: NO VERIFICADO
- [ ] Concurrent invoice emission keeps unique numbers. Expected result: unique fiscal numbers with no duplicate invoice. Actual result/evidence: NO VERIFICADO
- [ ] Double payment leaves one posted payment. Expected result: one valid payment or idempotent replay/controlled rejection. Actual result/evidence: NO VERIFICADO
- [ ] Cash close during simultaneous operations is safe. Expected result: no closed session with lost payment/pending mismatch. Actual result/evidence: NO VERIFICADO

## Command

```powershell
$env:HOSPITAL_VALIDATE_REAL_MYSQL="1"
$env:HOSPITAL_CONCURRENCY_BASE_URL="http://IP_DEL_SERVIDOR"
$env:HOSPITAL_CONFIRM_CONCURRENCY_TARGET="http://IP_DEL_SERVIDOR"
$env:HOSPITAL_CONCURRENCY_TARGET_ENV="validation"
$env:HOSPITAL_CONCURRENCY_LOGIN="usuario.temporal"
$env:HOSPITAL_CONCURRENCY_PASSWORD="password-temporal"
$env:HOSPITAL_CONCURRENCY_EVIDENCE_PATH="qa/FINAL_CONCURRENCY_PROOF.md"
bash scripts/validate_mysql_concurrency.sh
```

## Evidence

- Notes: Pendiente de ejecucion contra base descartable/snapshot autorizado.
