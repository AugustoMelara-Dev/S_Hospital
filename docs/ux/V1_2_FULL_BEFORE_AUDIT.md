# V1.2 Full Before Audit

Fecha: 2026-06-28

Host solicitado: `http://192.168.1.10:8081`

Resultado: captura parcial.

## Estado

El runtime LAN respondio `200`, pero `e2e/production-readiness.spec.ts` fallo en el dashboard al esperar el heading anterior `centro de mando`. Esto indica que el host LAN no estaba alineado con la misma copia de frontend usada como base de trabajo de esta rama.

## Evidencia generada

Directorio: `qa/v1-2-full-ux-ui-redesign/before`

Capturas parciales:

- `login-light.png`
- `login-dark.png`
- `not-found-light.png`
- `access-denied-reports-light.png`
- `mobile-billing-light.png`

Reporte parcial:

- `rc-e2e-mocked-report.json`

## Decision QA

No usar esta captura parcial como gate visual completo. Para evidencia completa de la rama se uso servidor local de la rama en `http://127.0.0.1:5175` con API mockeada, sin datos reales.

La rama base `origin/codex/v1-2-visible-ui-delta` ya trae evidencia before/after completa en `qa/v1-2-visible-ui-delta`, y esta fase hereda ese delta como base util.
