# Final concurrency proof

Estado actual: PENDING_FINAL_CONCURRENCY_VALIDATION.

Este archivo documenta la validacion final de concurrencia contra una base
descartable o snapshot autorizado del entorno final. El script crea datos
auditables y no debe ejecutarse contra produccion activa sin snapshot, ventana
de mantenimiento y confirmacion explicita.

## Bloqueantes actuales

- Falta definir target final descartable o snapshot autorizado.
- Falta ejecutar doble apertura de caja y confirmar una sola verdad.
- Falta ejecutar emision concurrente y confirmar numeros fiscales unicos.
- Falta ejecutar doble pago y confirmar que solo un pago queda posteado.
- Falta adjuntar evidencia verificable bajo `qa/`.

## Comando recomendado

```bash
HOSPITAL_VALIDATE_REAL_MYSQL=1 HOSPITAL_CONFIRM_CONCURRENCY_TARGET=http://IP_DEL_SERVIDOR:8000 HOSPITAL_CONCURRENCY_BASE_URL=http://IP_DEL_SERVIDOR:8000 HOSPITAL_CONCURRENCY_TARGET_ENV=validation HOSPITAL_CONCURRENCY_EVIDENCE_PATH=qa/FINAL_CONCURRENCY_PROOF.md scripts/validate_mysql_concurrency.sh
```

## Resultado operativo

Mientras este archivo siga pendiente, `scripts\production_readiness_preflight.ps1`
debe fallar y cualquier entrega debe quedar como `PRODUCTION_CANDIDATE`, no como
`PRODUCTION_READY`.
