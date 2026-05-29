# Fase 2 - Recibo institucional en papel

Fecha: 2026-05-29
Branch: `codex/hospital-san-isidro-rc`

## Alcance ejecutado

- El recibo queda limitado a papel institucional: media carta, carta y A5.
- Los endpoints de recibo y reimpresion rechazan `80mm` y `58mm`.
- Los snapshots antiguos con formato legado se normalizan a media carta para imprimir en papel.
- El recibo muestra `Configuracion pendiente` si CAI, rango o fecha limite no son datos reales.
- Se removieron estilos `thermal-receipt` y variantes de recibo `80mm/58mm`.
- Los seeders locales restauran Hospital San Isidro y no crean CAI demo como autorizacion visible.
- El smoke visual bloquea QR, barcode, `80mm`, `58mm`, ticket termico y nombres heredados visibles.

## Archivos principales

- `backend/app/Actions/Receipts/GenerateReceiptDataAction.php`
- `backend/app/Http/Requests/Receipts/ShowReceiptRequest.php`
- `backend/app/Http/Requests/Receipts/ReprintReceiptRequest.php`
- `backend/app/Http/Requests/Fiscal/UpdateFiscalSettingsRequest.php`
- `backend/app/Support/HospitalName.php`
- `backend/database/seeders/DevelopmentDemoSeeder.php`
- `frontend/src/features/receipts/ReceiptPreview.tsx`
- `frontend/src/features/invoices/NewInvoiceView.tsx`
- `frontend/src/features/settings/FiscalSettingsView.tsx`
- `frontend/src/features/settings/components/FiscalSettingsForm.tsx`
- `frontend/src/lib/api/types.ts`
- `frontend/src/styles.css`
- `qa/visual-smoke/field-qa-current-screenshots.mjs`

## Verificacion ejecutada

- `docker compose exec -e APP_ENV=testing -e DB_CONNECTION=sqlite -e DB_DATABASE=:memory: backend php artisan test --colors=never --filter=CashPaymentsReceiptTest`
  - Resultado: 17 tests, 138 aserciones pasaron.
- `docker compose exec -e APP_ENV=testing -e DB_CONNECTION=sqlite -e DB_DATABASE=:memory: backend php artisan test --colors=never --filter=InvoiceHistoryReprintVoidTest`
  - Resultado: 13 tests, 91 aserciones pasaron.
- `docker compose exec -e APP_ENV=testing -e DB_CONNECTION=sqlite -e DB_DATABASE=:memory: backend php artisan test --colors=never --filter=HospitalNameTest`
  - Resultado: 2 tests, 7 aserciones pasaron.
- `cd frontend && npm.cmd run test -- NewInvoiceView.test.tsx`
  - Resultado: 12 tests pasaron.
- `cd frontend && npm.cmd run typecheck`
  - Resultado: paso.
- `cd frontend && npm.cmd run lint`
  - Resultado: paso.
- `cd frontend && npm.cmd run check:branding`
  - Resultado: paso sin hallazgos.
- `cd frontend && npm.cmd run build`
  - Resultado: paso. Vite mantiene advertencia no bloqueante por chunk `index` mayor a 500 kB.
- `node qa\visual-smoke\field-qa-current-screenshots.mjs`
  - Resultado: paso, `failing: []`.

## Evidencia visual

- `qa/screenshots/field-qa-2026-05-29-fixed/10-receipt-preview.png`
- `qa/screenshots/field-qa-2026-05-29-fixed/field-qa-fixed-report.json`

## Incidente de pruebas

La primera corrida backend se ejecuto sin forzar SQLite y Laravel uso las variables Docker de MariaDB. Eso dejo la base local sin usuarios. No se hizo `migrate:fresh` ni reset. Se restauro la operacion local con:

- `docker compose exec backend php artisan db:seed --class=DatabaseSeeder --no-interaction`
- `docker compose exec backend php artisan permission:cache-reset --no-interaction`
- `docker compose exec backend php artisan cache:clear --no-interaction`

Desde ese punto, las pruebas backend se ejecutan explicitamente con `DB_CONNECTION=sqlite` y `DB_DATABASE=:memory:`.

## Criterios de aceptacion

- El recibo visible no muestra QR, barcode, codigos internos, `80mm`, `58mm` ni ticket termico.
- El recibo muestra CAI/rango/fecha limite como configuracion pendiente cuando no hay datos reales.
- Reimpresion conserva snapshots historicos.
- El selector visible solo ofrece media carta, carta y A5.
- La captura real de recibo queda actualizada.
