# Known limitations

## Pendientes de entorno

- Restore real quedo `VALIDATED` en Fase 11 sobre MariaDB XAMPP local y base descartable `hospital_restore_validation_test`. Debe repetirse en el servidor final si cambia el equipo, ruta de dump o base real.
- Restore real cuenta con script Fase 10: `scripts/validate_restore_mysql.sh`. Es destructivo sobre la base descartable confirmada en `RESTORE_TEST_DATABASE`; no valida ni toca la base activa.
- La prueba fisica de impresora termica 80mm/58mm queda `PENDING_HARDWARE_VALIDATION` hasta tener impresora real o impresora compartida del hospital.
- La concurrencia real MySQL/MariaDB quedo `VALIDATED` en Fase 11 contra Laravel/MySQL local con `RUN_ID=concurrency-validation-20260517T20435`. El script crea datos auditables y requiere snapshot previo; repetir en servidor/base final descartable antes de operar.
- La validacion LAN desde computadora cliente queda `PENDING_LAN_CLIENT_VALIDATION` hasta probar por IP fija/nombre local del servidor desde otra PC.
- La configuracion final `APP_ENV=production`, `APP_DEBUG=false`, admin real y worker continuo de backups queda `PENDING_ENVIRONMENT_VALIDATION` hasta preparar el servidor final.

## Estado Fase 11

- DEMO_READY: si.
- PRODUCTION_CANDIDATE: si, con E2E local, rutas LAN, restore real local y concurrencia real local validados.
- PRODUCTION_READY: no, hasta cerrar LAN fisica desde cliente, impresora fisica y configuracion final de produccion.

## Alcance de producto

- No hay expediente clinico. Paciente en factura es solo nombre.
- No hay inventario.
- No hay dashboard complejo.
- No hay cloud sync.
- No hay restore UI.
- No hay PDF avanzado como modulo de entrega.

## Operacion

- Backup manual desde UI requiere worker local de cola `backups`.
- Backup real MySQL/MariaDB requiere `mariadb-dump` o `mysqldump` instalado en el servidor.
- Produccion offline debe crear `.env` real fuera del repositorio y no copiar credenciales de desarrollo.
- Los usuarios demo solo se crean en `local` o `testing`.
