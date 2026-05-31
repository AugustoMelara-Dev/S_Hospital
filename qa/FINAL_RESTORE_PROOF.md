# Final restore proof

Estado actual: PENDING_FINAL_RESTORE_VALIDATION.

Este archivo documenta la restauracion final contra una base descartable en el
servidor final o hardware equivalente aprobado. La evidencia local historica de
Fase 11 no sustituye esta prueba si cambian servidor, rutas, Docker, dump tool,
credenciales o base de datos.

## Bloqueantes actuales

- Falta seleccionar un backup `success` del servidor final.
- Falta verificar SHA256 y tamano del archivo.
- Falta restaurar sobre una base descartable, nunca sobre la base activa.
- Falta capturar conteos minimos de usuarios, roles, permisos, servicios,
  facturas, pagos, cajas y `backup_logs`.
- Falta adjuntar evidencia verificable bajo `qa/`.

## Comando recomendado

```bash
HOSPITAL_VALIDATE_RESTORE_MYSQL=1 RESTORE_TEST_DATABASE=hospital_restore_validation_test HOSPITAL_CONFIRM_RESTORE_DATABASE=hospital_restore_validation_test scripts/validate_restore_mysql.sh
```

## Resultado operativo

Mientras este archivo siga pendiente, `scripts\production_readiness_preflight.ps1`
debe fallar y cualquier entrega debe quedar como `PRODUCTION_CANDIDATE`, no como
`PRODUCTION_READY`.
