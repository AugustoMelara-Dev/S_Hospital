# Revision por commit - Fase 2

Fecha: 2026-05-29
Fase: Recibo institucional en papel y snapshot historico

## Decision

APROBADO

## Hallazgos por severidad

- Criticos: ninguno.
- Altos: ninguno.
- Medios:
  - El smoke visual necesita una factura existente para capturar recibo; se creo una factura local de evidencia. Para la fase final conviene que el smoke cree y limpie su propia evidencia de forma controlada.
- Bajos:
  - El build conserva advertencia de chunk `index` mayor a 500 kB.
  - Los usuarios seed de desarrollo aun dicen `Admin Demo`, `Supervisor Demo` y `Cajero Demo`; queda para fase de manuales/operacion final si se decide eliminar todo lenguaje demo visible.

## Revision por subagente

- Arquitectura y mantenibilidad: normalizacion de papel y placeholders centralizada en backend; UI usa tipos mas estrictos.
- Backend Laravel: requests rechazan formatos heredados; recibo usa snapshots de factura y pagos existentes.
- Frontend React: recibo muestra papel institucional, pendiente fiscal explicito y selector limitado a tres tamanos.
- Base de datos: sin migraciones nuevas; se preservan columnas legadas para compatibilidad.
- Seguridad: no se exponen secretos; no se modifica auth/permisos de produccion.
- Rendimiento: impacto minimo; no hay queries nuevas costosas.
- QA/TDD: cobertura backend/frontend ampliada y smoke visual actualizado.
- Dominio: se elimina ticket termico/QR/barcode del recibo y se evita inventar autorizacion fiscal.

## Pruebas revisadas

- `CashPaymentsReceiptTest`
- `InvoiceHistoryReprintVoidTest`
- `HospitalNameTest`
- `NewInvoiceView.test.tsx`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run check:branding`
- `npm.cmd run build`
- `node qa\visual-smoke\field-qa-current-screenshots.mjs`

## Comentarios inline sugeridos

Ninguno.

## Refactor minimo antes del siguiente commit

Ninguno para Fase 2. La siguiente fase debe centrarse en pagos parciales, saldos y conciliacion de caja.

## Riesgo de regresion

Medio-bajo. Cambia contratos de recibo para rechazar formatos heredados; las pruebas cubren rechazo y normalizacion de snapshots antiguos.
