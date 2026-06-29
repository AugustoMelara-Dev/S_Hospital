# Plan OFFLINE MODE - S_Hospital

## Contexto

El sistema S_Hospital está en v1.0.0 (READY FOR PILOT, ver `CHANGELOG.md`). La mayoría de la infraestructura OFFLINE ya está implementada y probada: backups cifrados con SHA256, restore con `-ExpectedSha256`, scripts de validación MySQL/MariaDB, manuales por rol, runbook de desastre, validación de impresión institucional, manual de actualización segura, 432 tests backend y 239 tests frontend pasando.

Este plan cierra las brechas detectadas contra el `CHECKLIST FINAL ESPECIAL OFFLINE` añadido al prompt maestro.

## Estado actual por subagente (16-30)

| # | Subagente | Estado | Evidencia |
|---|-----------|--------|-----------|
| 16 | Infraestructura Local / Hardware | PARCIAL | `SYSTEM_REQUIREMENTS.md` existe pero minimal (52 líneas, sin requisitos CPU/RAM/disco) |
| 17 | Red Local / LAN | CUBIERTO | `docs/OFFLINE_LAN_INSTALL.md`, `docs/PHASE_G_LAN_OFFLINE_VALIDATION_GUIDE.md`, `scripts/ping_lan_clients.ps1` |
| 18 | Continuidad Operativa | CUBIERTO | `docs/DISASTER_RECOVERY.md` (10 escenarios) |
| 19 | Backups / Restauración | CUBIERTO | `docs/BACKUP_RESTORE.md`, `scripts/restore_hospital_windows.ps1`, `scripts/validate_restore_mysql.sh`, cifrado `.sql.enc` con SHA256 |
| 20 | Seguridad Física | BRECHA | No existe documento dedicado |
| 21 | Seguridad de Endpoints | BRECHA | No existe documento dedicado |
| 22 | Instalador / Paquete Offline | CUBIERTO | `setup.bat`, `scripts/deploy_hospital_lan.ps1`, `scripts/make_offline_release.ps1`, `scripts/assert_offline_release_clean.ps1` |
| 23 | Actualizaciones Offline | CUBIERTO | `docs/manuales/MANUAL_ACTUALIZACION_SEGURA.md`, `docs/manuales/CHECKLIST_ACTUALIZACION_SEGURA.md` |
| 24 | Impresión y Documentos | CUBIERTO | `docs/INSTITUTIONAL_RECEIPT_PRINT_VALIDATION.md`, `docs/THERMAL_PRINTER_VALIDATION.md` |
| 25 | Fecha, Hora, Trazabilidad | PARCIAL | Existe zona horaria y timestamps; falta doc explícito de procedimiento |
| 26 | Auditoría Local | CUBIERTO | `docs/AUDITORIA_CONTROL_INTERNO.md` (30+ eventos auditados, `audit_logs` tabla) |
| 27 | Migración / Exportación | PARCIAL | `/api/reports/export` existe; falta cobertura de pacientes/citas y manual de migración |
| 28 | Mantenimiento Local | BRECHA | `docs/manuales/CHECKLIST_VALIDACION_CAMPO.md` cubre campo inicial; falta rutina recurrente |
| 29 | Capacitación y Aceptación | CUBIERTO | 12 manuales en `docs/manuales/`, `CHECKLIST_CAPACITACION.md` |
| 30 | Escenario Sin Internet | BRECHA | No existe validación dedicada de no-dependencia de CDN/APIs |

## Brechas a cerrar

1. **Hardware**: expandir `SYSTEM_REQUIREMENTS.md` con CPU/RAM/disco/so mínimos y recomendados.
2. **Seguridad física**: nuevo `docs/PHYSICAL_SECURITY.md` (acceso al servidor, USB, impresiones).
3. **Seguridad de endpoints**: nuevo `docs/ENDPOINT_SECURITY.md` (antivirus, política USB, permisos SO).
4. **Fecha/hora**: nuevo `docs/DATETIME_POLICY.md` (zona horaria, advertencia de reloj, procedimiento de corrección).
5. **Migración/exportación**: nuevo `docs/DATA_MIGRATION.md` (exportar pacientes/citas, restaurar, formatos).
6. **Mantenimiento local**: nuevo `docs/MAINTENANCE_ROUTINE.md` (checklist diario/semanal/mensual).
7. **Validación sin internet**: nuevo `qa/OFFLINE_SCENARIO_VALIDATION.md` + script que audite package.json/composer.json por dependencias externas.
8. **Dictamen final**: nuevo `docs/OFFLINE_DICTAMEN_FINAL.md` con uno de los 4 estados.

## Fases de ejecución

### OFF-A · Gap audit y plan (CERRADO — este documento)
- Resultado: este `docs/OFFLINE_MODE_PLAN.md`.
- Commit: `docs(offline): add offline mode gap analysis and phased plan`
- Quality gate: revisión humana del plan antes de OFF-B.

### OFF-B · Documentación de soporte offline
**Alcance**: crear/expandir 5 documentos de soporte.

Archivos esperados:
- `SYSTEM_REQUIREMENTS.md` (expandido con CPU/RAM/disco/so)
- `docs/PHYSICAL_SECURITY.md` (nuevo)
- `docs/ENDPOINT_SECURITY.md` (nuevo)
- `docs/DATETIME_POLICY.md` (nuevo)
- `docs/DATA_MIGRATION.md` (nuevo)
- `docs/MAINTENANCE_ROUTINE.md` (nuevo)

Quality gate:
- Revisión por subagentes 16, 20, 21, 25, 27, 28.
- Cada doc referencia scripts/comandos reales del repo.
- Sin `lorem ipsum` ni placeholders.

Commit sugerido: `docs(offline): add physical endpoint datetime migration maintenance docs`

### OFF-C · Validación de escenario sin internet
**Alcance**: auditar dependencias externas y producir evidencia.

Archivos esperados:
- `scripts/audit_offline_dependencies.ps1` (nuevo, audita package.json/composer.json por CDN/API/licencia online)
- `scripts/audit_offline_dependencies.sh` (equivalente bash)
- `qa/OFFLINE_SCENARIO_VALIDATION.md` (resultado + remediaciones)
- `frontend/src/lib/offline/indicators.ts` (helper que muestra mensajes claros para funciones no disponibles)
- Test Vitest del helper

Quality gate:
- Script detecta correctamente CDN, fuentes remotas, APIs externas.
- Vitest pasa.
- Backend `php artisan test --filter=Offline` (si se crea test específico).
- `qa/qa-offline-scenario.txt` con output del script.

Commit sugerido: `test(offline): add no-internet scenario validation and dependency audit`

### OFF-D · Procedimiento de rollback de actualización
**Alcance**: asegurar que el flujo de actualización tenga rollback ejecutable y probado en base descartable.

Archivos esperados:
- `scripts/rollback_update.ps1` (nuevo, restaura backup pre-update + artefactos previos)
- `scripts/rollback_update.sh` (equivalente bash)
- `docs/manuales/CHECKLIST_ACTUALIZACION_SEGURA.md` (actualizado con paso de rollback obligatorio)
- Test PHPUnit que verifica flujo de preflight + rollback

Quality gate:
- Rollback ejecutado en base descartable con `-ExpectedSha256`.
- Sin pérdida de pacientes/citas/historial.
- Doc actualizado con paso numerado.

Commit sugerido: `feat(offline): add update rollback procedure and preflight`

### OFF-E · Dictamen final OFFLINE
**Alcance**: producir el dictamen formal contra el CHECKLIST FINAL del prompt maestro.

Archivos esperados:
- `docs/OFFLINE_DICTAMEN_FINAL.md` (dictamen con uno de los 4 estados)
- `docs/OFFLINE_CHECKLIST_FINAL.md` (CHECKLIST FINAL rellenado punto por punto)
- Actualizar `docs/KNOWN_LIMITATIONS.md` con pendientes reales

Quality gate:
- Cada item del CHECKLIST FINAL tiene evidencia o limitación documentada.
- Dictamen firmado (nombre del responsable + fecha).
- Si dictamen = 3 (Listo para despliegue local controlado), debe pasar todas las brechas OFF-B/C/D.

Commit sugerido: `docs(offline): final offline dictum and checklist evidence`

## Riesgos y mitigaciones

- **R1**: Documentación desactualizada. Mitigación: cada doc cita commits/scripts vigentes; revisión por subagente correspondiente.
- **R2**: Validación offline no se puede ejecutar en dev con internet. Mitigación: el script es estático (analiza package.json/composer.json), no requiere red.
- **R3**: Rollback puede borrar datos si se ejecuta mal. Mitigación: exigir `-WhatIf` + base descartable + checksum; mismo patrón que `restore_hospital_windows.ps1`.
- **R4**: Tiempo de ejecución. Cada fase es ≤ 1 commit y commiteable de forma independiente; no hay bloqueos cruzados.

## Criterio de cierre del plan OFFLINE

El plan se considera completo cuando:

- Todos los docs OFF-B existen y son revisados.
- El script `audit_offline_dependencies` corre y produce `qa/OFFLINE_SCENARIO_VALIDATION.md` con 0 hallazgos críticos.
- El rollback de OFF-D se ejecuta en base descartable con éxito.
- `docs/OFFLINE_DICTAMEN_FINAL.md` declara estado 1, 2 o 3 (no estado 4).
- Quality gate del proyecto sigue verde: 432/432 backend, 239/239 frontend, pint, phpstan, typecheck, lint, build.

## Comando de verificación global

```powershell
# Backend
cd C:\Projects\S_Hospital
docker compose exec backend php artisan test --colors=never
docker compose exec backend vendor/bin/pint --test
docker compose exec backend vendor/bin/phpstan analyse --no-progress

# Frontend
cd frontend
npm run typecheck
npm run lint
npm run test
npm run build

# Offline audit
powershell.exe -ExecutionPolicy Bypass -File scripts\audit_offline_dependencies.ps1
```

## Orden de ejecución recomendado

OFF-A (este doc) → OFF-B → OFF-C → OFF-D → OFF-E

Cada fase:
1. Implementar archivos.
2. Correr quality gate.
3. Commit con mensaje conventional.
4. Reportar avance antes de la siguiente fase.
