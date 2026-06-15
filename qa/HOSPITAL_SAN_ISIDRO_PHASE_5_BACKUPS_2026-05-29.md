# Fase 5 - Respaldos, verificacion y restauracion segura

Fecha: 2026-05-29
Branch: `codex/hospital-san-isidro-rc`

## Alcance ejecutado

- La pantalla de respaldos explica el flujo operativo: crear, verificar y restaurar con prueba.
- El historial muestra tipo de respaldo: manual o automatico.
- El historial muestra verificacion comprensible:
  - `En proceso` para pendientes.
  - `No verificado` para fallidos.
  - `SHA256 xxxxxxxx` para respaldos completados con huella de integridad.
- La UI aclara que no existe restauracion directa desde la pantalla y que primero debe validarse en una base descartable.
- Se mantiene el backend sin endpoint de restauracion destructiva.
- Se mantuvo la proteccion existente: el API no expone ruta/disk, no descarga fallidos, bloquea path traversal y audita descargas.

## Archivos principales

- `frontend/src/features/backups/BackupsView.tsx`
- `frontend/src/features/backups/components/BackupExplanationCard.tsx`
- `frontend/src/features/backups/components/BackupStatusBadge.tsx`
- `frontend/src/App.test.tsx`

## Migraciones

No se agregaron migraciones. `backup_logs.checksum_sha256`, `size_bytes`, `status`, `type`, `created_at` y `completed_at` ya cubren el historial requerido.

## Verificacion ejecutada

- `cd frontend && npm.cmd run test -- App.test.tsx`
  - Resultado: 11 tests pasaron.
- `cd frontend && npm.cmd run typecheck`
  - Resultado: paso.
- `cd frontend && npm.cmd run lint`
  - Resultado: paso.
- `docker compose exec -e APP_ENV=testing -e DB_CONNECTION=sqlite -e DB_DATABASE=:memory: backend php artisan test --colors=never --filter=BackupWorkflowTest`
  - Resultado: 14 tests, 56 aserciones pasaron.
- `cd frontend && npm.cmd run build`
  - Resultado: paso. Vite mantiene advertencia no bloqueante por chunk `index` mayor a 500 kB.
- `cd frontend && npm.cmd run check:branding`
  - Resultado: paso sin hallazgos.

## Riesgos y notas

- No se habilito restore por UI. Esto es intencional para evitar pisar datos reales desde navegador.
- La validacion de restore sigue siendo procedimiento controlado en base descartable, documentado para administracion tecnica.
- Falta una prueba de campo en el servidor final: crear backup manual, esperar `success`, descargarlo y validar restore contra base descartable real.

## Criterios de aceptacion

- Un administrador no tecnico puede ver fecha, tipo, tamano, estado y verificacion de cada respaldo.
- La pantalla no muestra rutas internas, contenedores, comandos o variables tecnicas como instrucciones operativas normales.
- Los usuarios sin permiso no ven ni crean respaldos.
- No existe endpoint destructivo de restauracion.
