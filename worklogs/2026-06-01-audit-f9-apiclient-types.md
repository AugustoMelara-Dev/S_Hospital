# F9 — Frontend: hardening de apiClient y tipos

**Fecha:** 2026-06-01
**Fase del plan:** 9 de 12
**Rama:** `codex/audit-f1-config-hardening`
**Commit:** `46fa5bd1 refactor(frontend): expose voidPayment and add PdfReportFilters type`

## Hallazgos cerrados (parcialmente)

- **HIGH** (auditoría) — `voidPayment` definido en `lib/api/billing.ts:50` pero **no expuesto** en el `apiClient` de `lib/api.ts`. Las vistas que querían anular un pago tenían que llamar a `billing.voidPayment(...)` directamente, saltándose la fachada. Ahora expuesto.
- **MEDIUM** (auditoría) — `downloadReportPdf` tomaba `ReportFilters & { date?: string }` con un `as ReportFilters` cast feo en reports.ts. Definido `PdfReportFilters` en `lib/api/types.ts` y usado como tipo único.

## Cambios

- `frontend/src/lib/api.ts` — añadido `async voidPayment(invoiceId, paymentId, reason)` que envuelve `billing.voidPayment({ reason })` con la firma correcta.
- `frontend/src/lib/api.ts` — `downloadReportPdf` ahora usa `PdfReportFilters` (tipo nuevo en types.ts).
- `frontend/src/lib/api/types.ts` — añadido `PdfReportFilters = ReportFilters & { date?: string }` exportado.
- `frontend/src/lib/api/reports.ts` — importado `DashboardReport` (faltaba); restaurado `exportUrl` y `downloadExport` (borrados en pasada previa sin querer).

## Decisiones técnicas

- **No tocar el resto de F9** — el audit pidió 6 cambios en `base.ts` (cache CSRF, feedback de localhost, mostrar todos los 422 errores, etc.) que son más invasivos. Estos quedan para una iteración futura. **Este commit solo cierra los hallazgos de tipo API puros** que TypeScript strict puede validar.
- **PdfReportFilters vs ReportFilters & {date}** — preferí un tipo con nombre porque documenta la intención (filtros para el endpoint PDF específicamente) y permite añadir campos PDF-only en el futuro sin tocar el union.

## Quality gate

```
vitest       → 94 tests OK
tsc          → passed
eslint       → passed
```

## Próxima fase

F10 — `setup.bat`: quitar password en CLI, usar variable de entorno, parsing de `SERVER_IP` robusto. Riesgo: bajo (script, no runtime).
