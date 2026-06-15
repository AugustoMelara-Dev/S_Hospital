# Checklist de Actualizacion Segura

Usar una copia de este checklist por cada actualizacion real.

## Identificacion

- [ ] Fecha y hora:
- [ ] Responsable tecnico:
- [ ] Responsable hospital:
- [ ] Version/commit instalado antes:
- [ ] Version/commit objetivo:
- [ ] Ventana de mantenimiento aprobada:
- [ ] Cajeros avisados y operacion detenida:

## Preflight

- [ ] `scripts\update_release_preflight.ps1` ejecutado sin bloqueantes.
- [ ] Rama/commit o manifest del paquete validado.
- [ ] Estado Git limpio o paquete offline sin cambios locales.
- [ ] `.env` real identificado y fuera de Git.
- [ ] `backend/storage` identificado como carpeta a preservar.
- [ ] No se detecto instruccion de `migrate:fresh`, `drop`, `reset` o borrado de
      storage para esta actualizacion.

## Backup previo

- [ ] Backup manual creado.
- [ ] Backup quedo `success`/Protegido.
- [ ] Tamano mayor a cero:
- [ ] SHA256:
- [ ] Copia externa/USB/ruta protegida:
- [ ] Restore a base temporal validado o excepcion aprobada:

## Protecciones

- [ ] `.env` raiz preservado si existe.
- [ ] `backend/.env` preservado.
- [ ] `backend/storage/app/private/backups` preservado.
- [ ] `backend/storage/app/public/branding` preservado.
- [ ] PDFs/recibos/snapshots conservados en base de datos y storage asociado.
- [ ] Configuracion fiscal revisada antes de actualizar.
- [ ] Configuracion de recibos institucionales revisada antes de actualizar.

## Actualizacion

- [ ] Paquete nuevo copiado sin reemplazar `.env` ni `storage`.
- [ ] No se ejecuto `php artisan migrate:fresh`.
- [ ] No se ejecuto `php artisan db:wipe`.
- [ ] No se ejecuto rollback/reset de migraciones.
- [ ] Migraciones incrementales ejecutadas con `php artisan migrate --force`.
- [ ] Cache regenerada.
- [ ] Servicios reiniciados o contenedores levantados.
- [ ] Worker de respaldos validado.

## Health checks

- [ ] `/up` responde.
- [ ] `/login` carga.
- [ ] `/verify-email` responde.
- [ ] Login admin funciona.
- [ ] Login cajero funciona.
- [ ] Caja muestra estado correcto.
- [ ] Historial muestra facturas previas.
- [ ] Reportes cargan.
- [ ] Respaldos cargan.
- [ ] Configuracion fiscal conserva datos.
- [ ] Configuracion de recibos conserva serie/perfiles.

## Datos criticos

Registrar antes/despues:

| Dato | Antes | Despues | OK |
|---|---:|---:|---|
| Usuarios activos | | | |
| Servicios activos | | | |
| Facturas | | | |
| Pagos | | | |
| Cajas | | | |
| Respaldos | | | |
| Series fiscales activas | | | |
| Series de recibo activas | | | |

## Rollback

- [ ] Copia del paquete anterior disponible.
- [ ] Procedimiento de rollback leido antes de actualizar.
- [ ] Responsable autorizado para decidir rollback identificado.
- [ ] Criterio de rollback definido:
- [ ] Resultado final: aceptado / rollback / detenido.

### Procedimiento de rollback (oficial)

Si la actualizacion falla o el preflight reporta bloqueantes, ejecutar el rollback
orquestado con `scripts\rollback_update.ps1` (Windows) o
`scripts/rollback_update.sh` (Linux). NUNCA rollback manual sin este script.

**Paso 1 - SelfTest** (verifica entorno, no toca nada):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\rollback_update.ps1 -SelfTest
```

**Paso 2 - WhatIf** (simula sin modificar):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\rollback_update.ps1 `
  -BackupFile C:\backups\hospital-2026-06-14.sql.enc `
  -ExpectedSha256 5975701b3c288ae4b9cd4e75d1881a38173e2bc3c3e799bc4b77ab7ac3630362 `
  -PreviousReleasePath C:\releases\hospital-2026-06-10 `
  -WhatIf
```

**Paso 3 - Validacion en base descartable** (siempre, antes de produccion):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\rollback_update.ps1 `
  -BackupFile C:\backups\hospital-2026-06-14.sql.enc `
  -ExpectedSha256 5975701b3c288ae4b9cd4e75d1881a38173e2bc3c3e799bc4b77ab7ac3630362 `
  -PreviousReleasePath C:\releases\hospital-2026-06-10 `
  -TargetDatabase hospital_rollback_validation `
  -UseExistingEnv
```

**Paso 4 - Rollback de produccion** (solo si la validacion pasa y el
responsable tecnico lo autoriza):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\rollback_update.ps1 `
  -BackupFile C:\backups\hospital-2026-06-14.sql.enc `
  -ExpectedSha256 5975701b3c288ae4b9cd4e75d1881a38173e2bc3c3e799bc4b77ab7ac3630362 `
  -PreviousReleasePath C:\releases\hospital-2026-06-10 `
  -TargetDatabase hospital_billing `
  -UseExistingEnv `
  -ForceProductionRestore
```

El script exigira la confirmacion textual `ROLLBACK` antes de continuar.

### Que hace el script

1. Crea snapshot del codigo actual en `install-logs/rollback_code_YYYYMMDD_HHMMSS/`.
2. Valida SHA256 del backup (rechaza si no coincide).
3. Restaura `backend/` y `frontend/` desde `PreviousReleasePath`.
4. Restaura la base de datos con `restore_hospital_windows.ps1` (que ya exige
   `-ExpectedSha256` y maneja `.sql.enc` descifrado a temporal controlado).
5. Ejecuta `production_readiness_preflight.ps1` (omite pruebas fisicas).
6. Deja el log en `install-logs/rollback_update_*.log`.

### Despues del rollback

- [ ] Validar `/up` y `/login` desde una estacion cliente.
- [ ] Confirmar que las facturas y pagos previos siguen visibles.
- [ ] Documentar fecha, SHA256, responsable y motivo en
      `qa/INCIDENT-YYYY-MM-DD.md`.
- [ ] Mantener el snapshot de codigo en `install-logs/` hasta confirmar que
      no se necesita.

## Cierre

- [ ] Evidencia guardada en `qa/` o carpeta de soporte.
- [ ] Manuales actualizados si cambio el procedimiento.
- [ ] No se declara `PRODUCTION_READY`.
- [ ] Estado final permitido: `TECHNICAL_RELEASE_CANDIDATE_PENDING_FIELD_VALIDATION`.
