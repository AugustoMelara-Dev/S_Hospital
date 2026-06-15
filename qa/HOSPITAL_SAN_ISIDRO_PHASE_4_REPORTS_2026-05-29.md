# Fase 4 - Reportes operativos de facturacion y cobro

Fecha: 2026-05-29
Branch: `codex/hospital-san-isidro-rc`

## Alcance ejecutado

- El reporte diario expone saldo pendiente separado de facturado y cobrado.
- El reporte por rango expone facturado, cobrado, saldo pendiente, metodos de pago y estados de factura.
- La UI de reportes muestra tarjetas separadas para facturado, cobrado y saldo pendiente.
- Las tablas de estados separan emitidas, parciales, pagadas y anuladas.
- Se corrigio lenguaje visible en reportes para evitar etiquetas ambiguas como `Total ingresos` cuando realmente era cobrado.
- Se mantuvo la regla de reportes: cobrado se basa en pagos registrados; facturado se basa en facturas no anuladas; saldo pendiente excluye anuladas.

## Archivos principales

- `backend/app/Actions/Reports/DailyReportService.php`
- `backend/app/Actions/Reports/IncomeReportService.php`
- `backend/tests/Feature/ReportsTest.php`
- `frontend/src/features/reports/components/DailyReportTab.tsx`
- `frontend/src/features/reports/components/IncomeReportTab.tsx`
- `frontend/src/features/reports/ReportsView.test.tsx`
- `frontend/src/lib/api/types.ts`

## Migraciones

No se agregaron migraciones. Los reportes usan columnas existentes de facturas y pagos.

## Verificacion ejecutada

- `cd frontend && npm.cmd run test -- ReportsView.test.tsx`
  - Resultado: 6 tests pasaron.
- `docker compose exec -e APP_ENV=testing -e DB_CONNECTION=sqlite -e DB_DATABASE=:memory: backend php artisan test --colors=never --filter=ReportsTest`
  - Resultado: 21 tests, 223 aserciones pasaron.
- `cd frontend && npm.cmd run typecheck`
  - Resultado: paso.
- `cd frontend && npm.cmd run lint`
  - Resultado: paso.
- `cd frontend && npm.cmd run build`
  - Resultado: paso. Vite mantiene advertencia no bloqueante por chunk `index` mayor a 500 kB.
- `docker compose exec backend vendor/bin/pint --test app/Actions/Reports/DailyReportService.php app/Actions/Reports/IncomeReportService.php tests/Feature/ReportsTest.php`
  - Resultado: paso.
- `cd frontend && npm.cmd run check:branding`
  - Resultado: paso sin hallazgos.
- `node qa\visual-smoke\field-qa-current-screenshots.mjs`
  - Resultado: paso sin bloqueantes visibles (`failing: []`). La recaptura de recibo se omitio por falta de factura visible en la base local actual, por lo que no se reemplazo la evidencia visual de recibo de Fase 2.

## Riesgos y notas

- Las exportaciones Excel/PDF siguen usando agregados del backend, pero esta fase no rediseno sus hojas visuales para mostrar tabla de estados por rango. Queda como mejora de release si se exige paridad visual completa entre pantalla y exportacion.
- `ReportsTest` desactiva throttle para evitar 429 durante exportaciones repetidas dentro de la suite; no cambia middleware de produccion.
- El reporte por rango conserva `invoice_count` como facturas con pagos en el periodo; la separacion de estados da el conteo facturado por estado.

## Criterios de aceptacion

- Reporte diario separa facturado, cobrado y saldo pendiente.
- Reporte por rango separa facturado, cobrado, saldo pendiente, metodos y estados.
- Anuladas no inflan facturado ni saldo pendiente.
- Parciales muestran saldo pendiente y conteo propio.
- La UI deja de llamar `Total ingresos` a lo cobrado.
