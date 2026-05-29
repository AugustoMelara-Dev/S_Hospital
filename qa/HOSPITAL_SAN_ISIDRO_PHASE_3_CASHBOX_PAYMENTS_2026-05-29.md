# Fase 3 - Pagos, saldos y conciliacion de caja

Fecha: 2026-05-29
Branch: `codex/hospital-san-isidro-rc`

## Alcance ejecutado

- El modal de cobro muestra referencia para tarjeta, transferencia y otros metodos.
- La referencia se envia al backend y queda disponible para recibo/reimpresion desde el snapshot de pagos.
- El modal aclara que solo efectivo aumenta el efectivo esperado de caja.
- Se reforzaron pruebas backend para:
  - rechazar pago menor al saldo cuando abonos parciales estan desactivados;
  - guardar referencia de transferencia;
  - bloquear cierre de caja con factura parcial.
- Se mantuvo la regla existente: tarjeta, transferencia y otros metodos no aumentan efectivo esperado.

## Archivos principales

- `frontend/src/features/invoices/components/PaymentModal.tsx`
- `frontend/src/features/invoices/NewInvoiceView.tsx`
- `frontend/src/features/invoices/NewInvoiceView.test.tsx`
- `backend/tests/Feature/CashPaymentsReceiptTest.php`

## Migraciones

No se agregaron migraciones. La columna `payments.reference` ya existia y el backend ya aceptaba `reference`.

## Verificacion ejecutada

- `cd frontend && npm.cmd run test -- NewInvoiceView.test.tsx`
  - Resultado: 13 tests pasaron.
- `cd frontend && npm.cmd run typecheck`
  - Resultado: paso.
- `docker compose exec -e APP_ENV=testing -e DB_CONNECTION=sqlite -e DB_DATABASE=:memory: backend php artisan test --colors=never --filter=CashPaymentsReceiptTest`
  - Resultado: 18 tests, 150 aserciones pasaron.
- `cd frontend && npm.cmd run lint`
  - Resultado: paso.
- `cd frontend && npm.cmd run build`
  - Resultado: paso. Vite mantiene advertencia no bloqueante por chunk `index` mayor a 500 kB.
- `docker compose exec backend vendor/bin/pint --test app/Actions/Payments/RegisterPaymentAction.php app/Actions/Cash/CloseCashSessionAction.php tests/Feature/CashPaymentsReceiptTest.php`
  - Resultado: paso en 3 archivos.
- `cd frontend && npm.cmd run check:branding`
  - Resultado: paso sin hallazgos.
- `node qa\visual-smoke\field-qa-current-screenshots.mjs`
  - Resultado: paso sin bloqueantes visibles. La base local actual no tenia un recibo visible para recapturar; se conserva la evidencia de recibo de Fase 2.

## Riesgos y notas

- El flujo de seleccion de metodo queda cubierto por prueba de componente; queda pendiente un E2E navegador que registre transferencia real desde la UI y confirme la referencia en recibo.
- El script temporal de evidencia de recibo no pudo abrir caja por 403 en la sesion local actual; no se reseteo base de datos ni se forzo restauracion.
- El build conserva la advertencia de chunk grande ya documentada.

## Criterios de aceptacion

- Pago menor al saldo no marca factura como pagada cuando abonos parciales estan desactivados.
- Con abonos parciales activados, la factura queda `partial` y el cierre de caja se bloquea hasta resolver el saldo.
- Tarjeta, transferencia y otros metodos no aumentan efectivo esperado.
- Referencia de pagos no efectivos se captura en UI y se persiste por backend.
