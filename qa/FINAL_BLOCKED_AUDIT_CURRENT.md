# Final blocked audit current

Fecha local: 2026-06-20
Base URL final actual: http://192.168.1.2:8081
Decision: READY_FOR_REAL_LAN_INSTALLATION_TEST

## Estado verificable en esta PC

- Docker stack final `shospital_offlinetest`: healthy.
- MariaDB/MySQL final: operativo.
- `http://192.168.1.2:8081/up`: 200 OK.
- `APP_URL`, `SANCTUM_STATEFUL_DOMAINS`, `CORS_ALLOWED_ORIGINS`, `PUSHER_CLIENT_HOST` y realtime LAN apuntan a `192.168.1.2`.
- Restore real final: OK en `qa/FINAL_RESTORE_PROOF.md`.
- Smoke real LAN final: OK en `qa/FINAL_REAL_SMOKE_LAN_8081.md`; login, navegacion, factura, cobro, recibo, History/reportes y export PDF/Excel pasaron contra `http://192.168.1.2:8081`.
- Concurrencia final: OK en `qa/FINAL_CONCURRENCY_PROOF.md`; doble apertura de caja `201/422`, numeros de factura unicos y doble pago `201/422`.
- Concurrencia bajo carga: OK en `qa/FINAL_CONCURRENCY_UNDER_LOAD_PROOF_LAN_8081.md`; 120 requests autenticados, 0 fallos, p95 1005 ms, caja/factura/pago controlados bajo carga.
- No quedan usuarios temporales `.validacion` activos segun preflight.
- Backup tasks: evidencia elevada PASS para `SistemaCajaHospitalaria-BackupWorker` y `SistemaCajaHospitalaria-DailyBackup` como SYSTEM; el shell no elevado puede reportarlas como no instaladas por permisos de Windows.
- Offline release artifact: `OFFLINE_RELEASE_CLEAN: YES`.
- `storage/logs` existe y es escribible por `www-data` dentro de la imagen productiva.

## Preflight actual

Comando:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\final_production_handoff.ps1 -BaseUrl http://192.168.1.2:8081 -EnvFile C:\tmp\s_hospital_offlinetest.env -ComposeProjectName shospital_offlinetest
```

Resultado relevante:

```text
[ OK ] final restore evidence is present and completed.
[ OK ] final concurrency evidence is present and completed.
[ OK ] final concurrency under load evidence is present and completed.
[ OK ] final real LAN smoke evidence is present and completed.
[FAIL] LAN client proof is marked as historical or requiring repeat; rerun scripts\validate_lan_client.ps1 from the second PC against final BaseUrl http://192.168.1.2:8081.
[FAIL] Complete a checked evidence item with a result for 'headers/footers' in qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md.
PRODUCTION_READY: NO (2 blocking issue(s))
```

## Bloqueos que impiden PRODUCTION_READY

### 1. Segunda PC LAN contra la IP final

La segunda PC fisica fue validada antes contra `192.168.1.7:8081`, pero la IP final actual es `192.168.1.2`.

Desde la segunda PC ejecutar:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\validate_lan_client_standalone.ps1 -BaseUrl http://192.168.1.2:8081 -EvidencePath "$env:USERPROFILE\Desktop\LAN_CLIENT_VALIDATION_PROOF.md"
```

Si la segunda PC tiene el repo:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 -BaseUrl http://192.168.1.2:8081 -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md -Force
```

### 2. Impresion fisica institucional

Archivo actual: `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md`

Bloqueo real: falta evidencia fisica de papel, incluyendo headers/footers del navegador desactivados. Las impresoras virtuales validan PDF/layout, pero no sustituyen alimentacion, escala, margenes, orientacion, driver ni legibilidad real.

Despues de imprimir en papel real, registrar:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\register_physical_receipt_print_proof.ps1 `
  -PrimaryPaperSize "media carta" `
  -ResponsiblePerson "NOMBRE_RESPONSABLE" `
  -PrinterBrandModel "MARCA_MODELO_IMPRESORA_REAL" `
  -PrinterDriver "NOMBRE_DRIVER_WINDOWS" `
  -ConnectionType "USB/LAN/Compartida" `
  -BrowserVersion "Microsoft Edge VERSION" `
  -InvoiceUsed "FACTURA/RECIBO_USADO" `
  -EvidenceReference "qa/evidence/printer-final/foto-media-carta.jpg" `
  -ReprintEvidence "Reimpresion desde historial con motivo auditado y misma informacion historica" `
  -MarginsEvidence "Escala 100%, margenes minimos, contenido centrado y legible" `
  -HeadersFootersEvidence "Encabezados y pies del navegador desactivados" `
  -HistoricalSnapshotEvidence "Servicios, paciente, monto y numero coinciden con la factura historica"
```

## Conclusion

No se puede declarar `PRODUCTION_READY` todavia por falta de dos evidencias fisicas/de campo. Todo lo verificable en esta PC contra `http://192.168.1.2:8081` quedo cerrado: restore, smoke real, concurrencia, concurrencia bajo carga, RBAC configurable, golden DB E2E, dependencias, Docker, backups y offline release.
