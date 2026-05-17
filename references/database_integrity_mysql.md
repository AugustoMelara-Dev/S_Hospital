# Referencia: integridad de base de datos MySQL/MariaDB

## Decisiones críticas
- Usar MySQL/MariaDB local para multiusuario LAN.
- No usar SQLite si varias computadoras facturan a la vez.
- Usar transacciones para crear factura + items + pago + movimiento de caja.
- Guardar snapshots en invoice_items: service_name, category_name, unit_price, tax_rate, line_total.

## Dinero
Preferencia: DECIMAL(12,2) en MySQL o enteros en centavos. No usar FLOAT/DOUBLE.

## Numeración de facturas
Debe ser atómica. Opciones:
1. Tabla fiscal_sequences bloqueada con SELECT ... FOR UPDATE dentro de transacción.
2. Registro settings con lock transaccional.
3. Unique index en invoice_number como última defensa.

## Anulación
No borrar. Marcar status='void', void_reason, voided_by, voided_at. Crear audit_log.

## Índices mínimos
- invoices(invoice_number) unique
- invoices(issue_date)
- invoices(patient_name)
- invoices(status)
- invoices(cash_session_id)
- payments(invoice_id)
- payments(paid_at)
- services(category_id, active)
- audit_logs(auditable_type, auditable_id)

## Riesgos a revisar
- Concurrencia de dos cajas creando factura al mismo tiempo.
- Cierre de caja mientras hay pago en proceso.
- Reportes lentos sin filtros.
- Migraciones destructivas.
