# Referencia para Reportes Avanzados

## Reglas de dinero

- Usar DECIMAL en DB.
- En agregaciones convertir/controlar centavos si hace falta.
- No usar float.

## Históricos

Usar snapshots:

- invoice_items.service_name
- invoice_items.category_name
- invoice_items.unit_price
- invoice_items.line_total

## Facturas void

No cuentan como ingreso.

## Pagos

Ingresos reales vienen de payments/cash_movements, no solo total de factura.

## Export

CSV mínimo:

- filtros aplicados
- fecha generación
- columnas claras

## Performance

- Índices en fechas, status, user_id, cash_session_id.
- Paginación.
- Rango máximo configurable.
