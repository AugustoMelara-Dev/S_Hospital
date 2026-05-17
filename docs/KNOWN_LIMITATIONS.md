# Known limitations

## Pendientes de entorno

- Restore real queda `PENDING_ENVIRONMENT_VALIDATION` hasta probar con MySQL/MariaDB real o Docker. No se afirma que restore fue validado en esta maquina.
- La prueba fisica de impresora termica 80mm/58mm queda pendiente hasta tener impresora real o impresora compartida del hospital.
- La concurrencia real MySQL/MariaDB debe validarse antes de produccion final, aunque los tests cubren reglas principales y restricciones esperadas.

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
