# Release notes - Sistema de Caja Hospitalaria v1.0.0

Fecha de release: 2026-06-02
Commit: ver `git log -1 v1.0.0`
Tag: `v1.0.0`
Estado: PRODUCTION_CANDIDATE

## Que incluye este release

Veinte fases de la auditoria 2026-06-02 mas cuatro fases
operacionales (manuales, runbook, script de ping LAN) implementadas
como codigo. El sistema esta listo para ser desplegado en el hospital
como paquete offline. La decision de `PRODUCTION_READY` requiere las
pruebas fisicas B1-B6 contra el hardware real.

## Metricas de calidad

- 342/342 tests PHPUnit backend (4 skipped legitimos)
- 211/211 tests Vitest frontend
- 0 errores de typecheck
- 0 errores de ESLint
- 0 errores de phpstan nivel 4 sobre 110 archivos
- Bundle gzipped mas grande: charts 116.73 kB (objetivo < 250 kB)
- Build de produccion sin warnings bloqueantes

## Fases cerradas en este release

### Codigo (A1-A10)

- **A9** LicenseHelper con `HOSPITAL_LICENSE_SALT` configurable
- **A2.1** Columnas cents en `invoices` e `invoice_items` con backfill
- **A2.2** `quantity_cents` y eliminacion de `ROUND(x * 100)` en 8 servicios de reporte
- **A1+A8** CSP nonce en produccion; `unsafe-inline` removido de `script-src`
- **A3** Entrypoint que espera MariaDB healthcheck; `setup.bat` espera healthcheck
- **A4** Rate limit 10/1min en `/api/health` y `/api/system/health`
- **A7** CSP report-uri endurecido (rate limit, content-type, size 4KB)
- **A10** Comandos `hospital:prune-audit-logs` y `hospital:prune-failed-jobs`
- **A5** NewInvoiceView 775 -> 490 lineas (Layout extraido)
- **A6** BackupsView muestra badge Worker activo/inactivo

### Operacional (C1-C3)

- **C1** 8 manuales para operador en `docs/manuales/`
- **C2** `docs/DISASTER_RECOVERY.md` con 10 escenarios
- **C3** `scripts/ping_lan_clients.ps1` para PC cliente

## Evidencia fisica pendiente (B1-B6)

Para llegar a `PRODUCTION_READY` se requiere evidencia fisica contra
el hardware real. Las plantillas y scripts ya estan listos:

1. **B1** `qa/LAN_CLIENT_VALIDATION_PROOF.md` - validar desde segunda PC
2. **B2** `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` - imprimir 5 tamanos
3. **B3** `qa/FINAL_RESTORE_PROOF.md` - restore en base descartable
4. **B4** `qa/FINAL_CONCURRENCY_PROOF.md` - concurrencia contra target descartable
5. **B5** `install_backup_tasks_windows.ps1` - tareas Windows activas
6. **B6** `final_production_handoff.ps1` - handoff guiado final

## Comandos utiles

```powershell
# Regenerar paquete offline despues de cambios:
powershell -ExecutionPolicy Bypass -File scripts\make_offline_release.ps1 -Force
powershell -ExecutionPolicy Bypass -File scripts\assert_offline_release_clean.ps1 -RequireCurrentCommit

# Pre-rellenar plantillas de evidencia:
powershell -ExecutionPolicy Bypass -File scripts\init_production_proofs.ps1

# Preflight final (debe retornar 0 sin -AllowMissingPhysicalProof):
powershell -ExecutionPolicy Bypass -File scripts\production_readiness_preflight.ps1 -BaseUrl http://IP-SERVIDOR:8000

# Handoff guiado:
powershell -ExecutionPolicy Bypass -File scripts\final_production_handoff.ps1 -BaseUrl http://IP-SERVIDOR:8000 -PhpPath C:\xampp\php\php.exe -InitializeProofFiles

# Validar desde una PC cliente:
powershell -ExecutionPolicy Bypass -File scripts\ping_lan_clients.ps1 -ServerUrl http://IP-SERVIDOR:8000 -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md
```

## Riesgos conocidos

- `NewInvoiceView` sigue en 490 lineas (objetivo <200 no alcanzado).
  El refactor a sub-reducers por paso esta diferido para v1.1.
- El rate limit del health endpoint es 10/1min, suficiente para
  preflight + dashboard, pero si se necesitan 4-5 healths por minuto
  simultaneos hay margen limitado.
- La licencia `LicenseHelper` usa un `SECRET_SALT` por defecto
  hardcodeado si no se configura `HOSPITAL_LICENSE_SALT`. En
  produccion se debe configurar explicitamente.
- `Differences` entre MySQL 8 y MariaDB 11 no estan validadas en
  CI. Se asume MariaDB 11 por la imagen Docker.

## Compatibilidad

- Windows 10 / 11 / Server 2019+ como servidor
- PowerShell 5.1+
- Docker Desktop o Docker Engine 24+
- MariaDB 11 o MySQL 8.0+
- Navegador: Chrome 120+, Edge 120+, Firefox 120+
- LAN: IPv4 fija recomendada
