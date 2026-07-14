# Matriz final de fallos del frontend

Fecha: 2026-07-14.

| Suite/gate | Archivos | Aprobados | Fallidos | Omitidos | Estado |
|---|---:|---:|---:|---:|---|
| Vitest segmentado | 132 | 965 | 0 | 0 | CERRADO |
| Storybook | 3 | 14 | 0 | 0 | CERRADO |
| Playwright mock | 39 recorridos | 39 | 0 | 0 | CERRADO |
| Matriz visual/axe | 4 recorridos agregados | 4 | 0 | 0 | CERRADO |
| Impresión browser/PDF | 27 recorridos del bloque recibos-reportes | 27 | 0 | 0 | CERRADO |
| TypeScript | — | 1 gate | 0 | 0 | CERRADO |
| ESLint | — | 1 gate | 0 | 0 | CERRADO |
| Build/análisis | — | 2 gates | 0 | 0 | CERRADO |
| Legacy inventory/strict/final | 329 runtime/test auditados | 3 gates | 0 | 0 | CERRADO |
| Playwright release | — | 0 | 0 de implementación | 1 externo | BLOQUEO EXTERNO |

Archivos de test descubiertos sin cubrir: 0. Archivos duplicados: 0. Archivos sin reporte: 0. Requests inesperados, `requestfailed`, `console.error` y `pageerror`: 0.

El release no inicia porque no existen `E2E_RELEASE_PASSWORD` ni `E2E_SEED_PASSWORD`; el preflight termina con un mensaje explícito antes de sembrar datos. No se omitió ni desactivó ninguna prueba para cerrar la matriz.
