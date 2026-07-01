# Migracion de `receipt_paper_size` a perfiles de impresion

Esta nota documenta la transicion del tamano de papel fiscal legacy hacia los
perfiles de impresion institucionales. El objetivo es separar configuracion
fiscal de configuracion de recibos sin romper facturas historicas ni clientes
antiguos.

## Estado actual

- La UI normal ya no cambia papel desde configuracion fiscal ni desde el wizard
  inicial.
- El operador cambia papel en `/settings/institutional-receipts`, dentro de los
  perfiles de impresion.
- `CreateInvoiceAction` resuelve el perfil con
  `ResolveReceiptPrintProfileAction` y guarda en `invoices.receipt_paper_size`
  un snapshot legacy normalizado para esa factura.
- `fiscal_settings.receipt_paper_size` sigue existiendo como compatibilidad y
  fallback operativo. No se debe eliminar todavia.
- `PUT /api/settings/fiscal` todavia acepta `receipt_paper_size`, pero responde
  con deprecacion cuando el campo viene en el payload.

## Mapeo de perfiles a snapshot legacy

`ReceiptPaperSize::fromProfilePaperKind()` traduce el perfil resuelto al valor
historico usado por recibos/facturas:

| `receipt_print_profiles.paper_kind` | `invoices.receipt_paper_size` |
|---|---|
| `half_letter_landscape` | `half_letter` |
| `letter_landscape` | `letter` |
| `a5_landscape` | `a5` |
| `thermal_80mm` | `80mm` |
| `thermal_58mm` | `58mm` |
| otro valor valido legacy | normalizado por `ReceiptPaperSize::normalize()` |

La factura historica no debe recalcular papel desde el perfil actual. El
snapshot en `invoices.receipt_paper_size` se conserva para reimpresion y
auditoria.

## Compatibilidad API

### Fiscal legacy

Ruta:

```text
PUT /api/settings/fiscal
```

Si el payload incluye `receipt_paper_size`, el backend:

- valida contra `half_letter`, `letter`, `a5`, `80mm`, `58mm`;
- guarda el valor por compatibilidad;
- responde con `warning`;
- responde con `_deprecated.receipt_paper_size`;
- agrega el header HTTP `Warning: 299 - "...receipt_paper_size..."`;
- si hay caja abierta y el valor cambio, agrega
  `X-S-Hospital-Paper-Size-Warning: mid-shift-change`.

Esto existe para clientes viejos y pruebas de compatibilidad, no para el flujo
operativo normal.

### Configuracion operativa

`GET /api/settings/operational` sigue devolviendo `receipt_paper_size` porque
algunas pantallas lo usan como fallback/previsualizacion mientras el backend
mantiene la fuente de verdad para la factura final.

### Perfiles institucionales

Rutas principales:

```text
GET   /api/settings/institutional-receipts
GET   /api/settings/institutional-receipts/print-profiles
PATCH /api/settings/institutional-receipts/print-profiles/{profile}
PUT   /api/settings/institutional-receipts/assignments
POST  /api/settings/institutional-receipts/test-print
```

La mutacion normal del perfil debe limitarse a opciones operativas: papel,
copias, logo autorizado, espacio para sello/firma, leyenda de copia, activo,
predeterminado global y plantilla. Campos manuales de ancho, alto, margenes,
fuente y escala requieren `receipt_settings.advanced`.

## Reglas de migracion

1. No borrar columnas legacy en esta fase:
   - `fiscal_settings.receipt_paper_size`;
   - `invoices.receipt_paper_size`.
2. No mover el papel de recibo de vuelta a configuracion fiscal.
3. No recalcular facturas historicas desde `receipt_print_profiles`.
4. Mantener seeders de perfiles reproducibles con media carta como default
   institucional.
5. Mantener termicas como compatibilidad secundaria; no deben ser default
   global institucional.
6. Mantener warnings para clientes que todavia escriben `receipt_paper_size` en
   fiscal.

## Procedimiento para operadores

Para cambiar el papel usado en nuevas facturas:

1. Abrir `/settings/institutional-receipts`.
2. Seleccionar el perfil institucional: Carta, Media carta, A5, Ticket 80 mm o
   Ticket 58 mm.
3. Ajustar copias, logo autorizado y espacio para sello/firma.
4. Usar **Imprimir prueba**.
5. Guardar el perfil o su asignacion.
6. Emitir una factura de prueba y verificar que el recibo use el papel elegido.

Si hay caja abierta, hacer el cambio con supervisor presente y dejar evidencia
en bitacora operativa.

## Procedimiento para desarrolladores

Antes de tocar esta area, verificar:

```bash
docker compose exec backend php artisan test --filter=FiscalSettingsTest
docker compose exec backend php artisan test --filter=InvoiceCreationTest
docker compose exec backend php artisan test --filter=ReceiptPrintProfile
docker compose exec frontend npm run test -- src/features/receipt-settings/InstitutionalReceiptSettingsView.test.tsx src/features/settings/FiscalSettingsView.test.tsx
docker compose exec frontend npm run typecheck
```

Pruebas clave esperadas:

- `FiscalSettingsTest::test_receipt_paper_size_update_returns_deprecation_warning`
- `InvoiceCreationTest::test_invoice_receipt_paper_size_uses_resolved_print_profile`
- pruebas de `InstitutionalReceiptSettingsView` donde el usuario normal no ve
  campos avanzados y soporte con `receipt_settings.advanced` si puede verlos.

## Criterios de aceptacion

- Configuracion fiscal normal no expone selector de papel.
- Wizard inicial no pide papel de recibo.
- `/settings/institutional-receipts` es el unico flujo normal para papel.
- Una factura nueva guarda `invoices.receipt_paper_size` desde el perfil
  resuelto.
- Clientes legacy reciben warning si mandan `receipt_paper_size` a fiscal.
- Reimpresiones historicas siguen usando snapshots existentes.
