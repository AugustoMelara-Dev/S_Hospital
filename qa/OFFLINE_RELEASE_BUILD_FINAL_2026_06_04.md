# Offline Release Build Final - 2026-06-04

> Resultado de regenerar `offline-release/` desde el commit
> `341f8a80d62dc35b118a839b498b1f37d758cbf6` con el script
> `scripts/make_offline_release.ps1 -Force -SkipDockerBuild`.

## Estado del guard

`OFFLINE_RELEASE_CLEAN: YES` (assert_offline_release_clean.ps1)

## Imagenes Docker incluidas

| Imagen              | Tamano    | SHA256 (preview)                                                |
|---------------------|-----------|-----------------------------------------------------------------|
| backend.tar         | 58.58 MB  | `EB1AF8ADD72DA75A812EAC959089CFA05F3EA61BEF3D7257AE6975935B957BA6` |
| mariadb.tar         | 105.48 MB | `E4A39A1226D30138BFB1B661775E763B5CE041220C6E39DD492187BD3EFDFAA0` |
| nginx.tar           | 20.73 MB  | `DF1B909B6CF2D15738761025E8FE0756C1B1E1FF5FEB107A9A32C78BC0D03E25` |
| queue-worker.tar    | 66.78 MB  | `88C230FBF61169CD3B32BD0811F30D3893CDA281880859A241D5F8D77BF69E55` |
| **Total**           | **251.56 MB** |                                                                 |

Cada tar incluye su `.sha256` validado contra el archivo
`checksums.sha256` en la raiz del paquete.

## Procedimiento ejecutado

1. `git status` -> working tree clean antes de empezar.
2. `powershell scripts/make_offline_release.ps1 -SelfTest` -> `[OK] SelfTest passed`.
3. `docker images s_hospital-backend:latest` y `s_hospital-queue-worker:latest`
   ya existian localmente con los tags esperados, por lo que se
   uso `-SkipDockerBuild` para evitar el rebuild de 5-10 minutos.
4. `docker save` produjo los 4 tars finales con su SHA256.
5. `assert_offline_release_clean.ps1 -SelfTest` valido layout,
   scripts criticos, plantillas de evidencia, manifest y checksums.
6. `assert_production_docker_sources.ps1` valido que el
   Dockerfile.prod y docker-compose.prod.yml del paquete
   coincidan con las fuentes productivas.
7. `validate_dependency_manifest.ps1` valido que
   `package_manifest.json` siga alineado con composer.json /
   package.json.

## Comandos de verificacion

```powershell
# Confirmar que el guard sigue limpio
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/assert_offline_release_clean.ps1 -SelfTest

# Re-correr el guard completo (necesita el paquete desplegado en el server)
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/assert_offline_release_clean.ps1

# Re-correr el preflight final
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/production_readiness_preflight.ps1 `
    -BaseUrl http://IP_SERVIDOR:8000
```

## Cambios incluidos respecto al paquete anterior (v1.0.0-rc.4)

- `frontend/src/lib/moneyCents.ts` - parseSignedCents, parseCentsOrZero, parseSignedCentsOrZero.
- `frontend/src/features/invoices/{hooks,components,state}` - deduplicacion de parseCurrency.
- `backend/app/Actions/Reports/OperationsReportService.php` - lazy(500) en pagos del cajero.
- `backend/app/Actions/Reports/CashSessionReportService.php` - sharedLock en sesiones abiertas.
- `backend/app/Http/Requests/{Billing,StoreInvoiceRequest, Cash/OpenCashSessionRequest, Catalog/StoreServiceRequest, Catalog/UpdateServiceRequest}` - regex y limites de monto.
- `backend/app/Providers/AppServiceProvider.php` - valida HOSPITAL_LICENSE_SALT >= 32 chars en prod.
- `backend/app/Events/{InvoiceChanged,PaymentChanged,CashSessionChanged}.php` - actor_id para dedup propio.
- `backend/app/Http/Controllers/HealthController.php` - cache 10s del snapshot.
- `backend/app/Actions/Reports/DashboardReportService.php` - cache 30s con invalidacion activa.
- `backend/app/Actions/Reports/OperationalMetricsService.php` - database_lag, queue_size, disk_free_gb, app_uptime_s.
- `docker-compose.prod.yml` - HOSPITAL_LICENSE_SALT requerido, --max-jobs/--max-time en worker, --max-connections en Soketi.
- Scripts nuevos: `post_install_quick_check.ps1`, `production_dry_run.ps1`.
- Modo `-Wizard` agregado a `install_backup_tasks_windows.ps1` y `refresh_lan_ip.ps1`.
- `refresh_lan_ip.ps1` ahora genera `qa/IP_CHANGE_NOTICE.txt` con instrucciones para PCs cliente.
- CI: gate obligatorio de `validate_dependency_manifest.ps1` en job backend-sqlite.
- Documentacion: `docs/SESSION_DRIVER_TRANSITION.md`, `docs/manuales/RUNBOOK_INCIDENTES_COMUNES.md`.

## Riesgos conocidos

- Las imagenes Docker fueron construidas en este entorno de
  desarrollo, NO en un build box oficial. El operador debe
  considerar reconstruir las imagenes en el build box final para
  garantizar que la cadena de suministro es limpia. Esto esta
  documentado en `docs/RELEASE_CHECKLIST.md`.
- El paquete NO fue probado en una VM sin internet. La fase
  siguiente (E2) cubre ese smoke antes de declarar PRODUCTION_READY.

## Proximos pasos

1. Transferir la carpeta `offline-release/` completa a un USB.
2. En la PC servidor del hospital, copiar la carpeta, ejecutar
   `setup.bat` como Administrador.
3. Completar las plantillas de evidencia fisica:
   - `qa/LAN_CLIENT_VALIDATION_PROOF.md` desde una segunda PC.
   - `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` desde la impresora real.
   - `qa/FINAL_RESTORE_PROOF.md` y `qa/FINAL_CONCURRENCY_PROOF.md`
     en una base descartable del servidor final.
4. Instalar las tareas Windows:
   `.\scripts\install_backup_tasks_windows.ps1` y
   `.\scripts\install_stack_autostart_windows.ps1`.
5. Ejecutar `scripts/production_readiness_preflight.ps1` sin
   `-AllowMissingPhysicalProof`.
6. Si retorna 0, ejecutar `scripts/final_production_handoff.ps1`
   y guardar `qa/FINAL_PRODUCTION_HANDOFF_RESULT.md` con
   `PRODUCTION_READY=YES`.
