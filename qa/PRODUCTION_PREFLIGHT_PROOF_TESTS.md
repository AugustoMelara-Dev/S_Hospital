# Production preflight proof contract tests

Fecha: 2026-05-19

Estado: contrato validado para parser y plantillas. Esto no declara
`PRODUCTION_READY`; solo prueba que la barrera reconoce evidencia completa y
rechaza evidencia incompleta.

## Alcance

- `scripts/production_readiness_preflight.ps1`
- `qa/LAN_CLIENT_VALIDATION_PROOF.example.md`
- `qa/THERMAL_PRINTER_PROOF.example.md`

## Escenarios requeridos

| Escenario | Resultado esperado |
|---|---|
| Evidencia de impresora vacia | Falla por archivo demasiado corto. |
| Evidencia de impresora copiada desde plantilla | Falla por campo obligatorio vacio o check sin resultado. |
| Evidencia de impresora sin `80mm result:` | Falla con `Complete '80mm result:'`. |
| Evidencia de impresora sin `58mm result:` | Falla con `Complete '58mm result:'`. |
| Evidencia de impresora con campos minimos y checks llenos | La seccion de proof pasa con `physical thermal printer evidence is present and completed`. |
| `CORS_ALLOWED_ORIGINS=*` | Falla siempre. |
| `CORS_ALLOWED_ORIGIN_PATTERNS` no vacio | Falla siempre. |
| Windows sin `HospitalBillingOS-BackupWorker` instalado y corriendo | Falla siempre. |
| Windows sin `HospitalBillingOS-DailyBackup` instalado | Falla siempre. |
| `-AllowMissingPhysicalProof` | Falla con `PRODUCTION_READY: NO`; solo sirve para diagnostico parcial. |

## Campos criticos de impresora

El proof real debe usar los mismos nombres que valida el preflight:

```md
- Printer brand/model:
- Printer driver:
- Connection type:
- Browser/version:
- Cashier computer:
- Invoice used:
- 80mm result:
- 58mm result:
- Reprint result:
- Margins result:
- Browser headers/footers result:
- Problems found:
- Evidence/photo reference:
- Final conclusion:
```

Si no hubo problemas, escribir una frase concreta como `Ninguno encontrado
durante la prueba fisica`; no usar `N/A`, `TODO`, `PENDING`, `REPLACE` ni dejar
campos vacios.
