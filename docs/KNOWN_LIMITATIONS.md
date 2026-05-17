# Known limitations

## Pendientes de entorno

- Restore real queda `PENDING_ENVIRONMENT_VALIDATION` hasta probar con MySQL/MariaDB real o Docker. No se afirma que restore fue validado en esta maquina.
- Restore real cuenta con script Fase 10: `scripts/validate_restore_mysql.sh`. Es destructivo sobre la base descartable confirmada en `RESTORE_TEST_DATABASE`; no valida ni toca la base activa.
- La prueba fisica de impresora termica 80mm/58mm queda `PENDING_HARDWARE_VALIDATION` hasta tener impresora real o impresora compartida del hospital.
- La concurrencia real MySQL/MariaDB queda `PENDING_ENVIRONMENT_VALIDATION` hasta ejecutar `scripts/validate_mysql_concurrency.sh` contra servidor Laravel con MySQL/MariaDB descartable. El script crea datos con `RUN_ID` y requiere snapshot previo.
- La validacion LAN desde computadora cliente queda pendiente hasta probar por IP fija/nombre local del servidor.

## Estado Fase 10

- DEMO_READY: si.
- PRODUCTION_CANDIDATE: si, con E2E local, rutas LAN y scripts de validacion real agregados.
- PRODUCTION_READY: no, hasta cerrar restore real, concurrencia real, LAN fisica e impresora fisica.

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
