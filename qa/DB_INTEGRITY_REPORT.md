# Database Integrity Report — Sistema de Caja Hospitalaria

**Frente:** Resiliencia / Integridad de datos
**Fecha:** 2026-06-09

---

## Resumen

El esquema de base de datos de S_Hospital mantiene integridad
referencial, uniqueness y consistencia de montos en todas las
operaciones de caja y facturación. Las acciones críticas corren
dentro de transacciones DB; los locks `FOR UPDATE` serializan
operaciones concurrentes sobre las mismas filas.

---

## Tablas críticas (modelo de dominio)

| Tabla | Propósito | Volumen típico | Índices notables |
|---|---|---|---|
| `users` | Usuarios / cajeros / supervisores | < 50 | UNIQUE `username`, UNIQUE `email` |
| `cash_register_sessions` | Caja (apertura/cierre) | < 100/día | UNIQUE `open_user_id` (1 caja activa por cajero), `('user_id','status')` |
| `invoices` | Factura emitida | < 500/día | UNIQUE `invoice_number`, `('issued_at')`, `('patient_name')`, `('status')`, `('issued_by','issued_at')`, FK a `fiscal_sequences` y `users` |
| `invoice_items` | Líneas de factura | < 5/factura | FK a `invoices` (RESTRICT delete), FK a `services` |
| `payments` | Pagos | < 500/día | FK a `invoices` (RESTRICT), FK a `cash_register_sessions` (RESTRICT), FK a `users` (RESTRICT), `('invoice_id')`, `('cash_session_id','paid_at')`, `('user_id','paid_at')`, `('method')` |
| `cash_movements` | Movimientos de caja | < 1000/día | FK a `cash_register_sessions` (RESTRICT), FK a `payments` (RESTRICT nullable), `('cash_session_id','type')`, `('payment_id')` |
| `audit_logs` | Auditoría de acciones | < 1000/día | `('entity_type','entity_id')`, `('created_at')`, `('user_id')` |
| `fiscal_sequences` | Secuencias fiscales (CAI) | < 5 activas | (secuencia única, lock pesimista) |
| `idempotency_keys` | Deduplicación de POSTs | proporcional al tráfico | UNIQUE `('user_id','route_signature','idempotency_key')` |

---

## Constraints e índices verificados

### Foreign keys con `restrictOnDelete()`

Todas las FK de dominio (facturas, pagos, items, movimientos) usan
`constrained()->restrictOnDelete()`. Esto significa:

- Una factura **no se puede borrar** si tiene pagos.
- Un pago **no se puede borrar** si está en una caja.
- Una caja **no se puede borrar** si tiene pagos o movimientos.

Los flujos correctos son `void` (status=void, void_reason, voided_by)
y `reverse` (cancela pagos y aplica void). El sistema **nunca borra
facturas pagadas**.

### UNIQUE constraints que evitan estados inválidos

| Tabla | Columna | Previene |
|---|---|---|
| `cash_register_sessions` | `open_user_id` | Dos cajas abiertas para el mismo cajero |
| `idempotency_keys` | `(user_id, route_signature, idempotency_key)` | Doble inserción del mismo retry |
| `invoices` | `invoice_number` | Dos facturas con el mismo correlativo |
| `users` | `username` | Dos usuarios con el mismo login |
| `users` | `email` | Dos usuarios con el mismo correo |

### Índices que evitan scans innecesarios

- `invoices.issued_at` — para filtros por fecha en historial y reportes.
- `invoices.status` — para `WHERE status = 'partial'`.
- `payments.cash_session_id, paid_at` — para cierres de caja.
- `payments.invoice_id` — para listar pagos de una factura.
- `cash_movements.cash_session_id, type` — para movimientos de apertura/cierre.
- `audit_logs.user_id` — para filtrar auditoría por usuario.
- `audit_logs.created_at` — para reportes por rango de fecha.

Adicional a los explícitos en migraciones, Laravel agrega
automáticamente el índice PRIMARY KEY en cada `id` y los índices de FK.

---

## Dinero: enteros en centavos

Todo cálculo monetario usa el value object `App\Support\Money`:

- `Money::parseCents(string $value, string $field): int` — convierte
  decimal a entero en centavos con validación (rechaza `>2`
  decimales, signo negativo, formato inválido).
- `Money::parsePositiveCents(...)` — variante que rechaza `<=0`.
- `Money::formatCents(int $cents): string` — formato canónico
  `1234.56`.
- `Money::fromCents(int): self` y `Money::fromFloat(float): self` —
  constructores.
- `Money::sum(iterable, callable): self` — suma segura.
- `Money::allocate(array $weights): array` — split sin perder
  centavos (remainder se asigna centavo a centavo).

Las columnas `*_cents` (bigint) son la fuente de verdad; las columnas
`decimal(12,2)` se mantienen en paralelo y se regeneran vía
`Money::formatCents()` en cada escritura. El `MoneyDriftTest` (en el
anterior frente, pero los principios aplican) verifica que el
round-trip no acumula drift.

### Pruebas de drift verificadas

- `MoneyTest` (23 tests) — conversión decimal<->entero sin pérdida.
- `ReportPerformanceBaselineTest::test_facturado_cobrado_saldo_cuadra_with_seeded_data`
  — la identidad `billed = collected + pending` se mantiene con 100
  facturas y 100 pagos.

---

## Cierres de caja: integridad transaccional

`CloseCashSessionAction` (líneas 26-110):

1. `lockForUpdate` sobre `cash_register_sessions` (previene cierre
   concurrente).
2. Chequeo de status: `$lockedSession->status !== STATUS_OPEN` → 422.
3. Cálculo de pagos pendientes (`pending_invoice_count`). Si > 0 → 422.
4. Cálculo de expected cash amount (`expected_cents`).
5. Si `closing != expected` y `notes` vacío → 422.
6. UPDATE de la sesión (status=CLOSED, snapshots de pagos).
7. INSERT de `cash_movement` tipo `closing`.
8. INSERT de `audit_log`.
9. Broadcast WebSocket (afterCommit).
10. COMMIT.

Cualquier falla dentro de los pasos 1-9 hace rollback de los 8. El
doble cierre es **atómicamente imposible**.

---

## Reverso de facturas: integridad transaccional

`ReverseInvoiceAction` (líneas 50-136):

1. `lockForUpdate` sobre la factura.
2. Chequeo de status: `STATUS_VOID` → 422.
3. Iteración sobre `postedPayments` y llamada a `VoidPaymentAction`
   para cada uno (que a su vez crea un `cash_movement` de tipo
   `payment_void` con monto negativo, recalcula `paid_amount_cents`,
   `balance_due_cents`, y `status` de la factura).
4. UPDATE de la factura a `STATUS_VOID` con `void_reason` y
   `voided_by`, `voided_at`.
5. INSERT de un único `audit_log` con `old_values` (lista de pagos
   revertidos) y `new_values` (estado final).
6. Broadcast afterCommit.
7. COMMIT.

---

## Riesgo residual

| Riesgo | Mitigación | Estado |
|---|---|---|
| Discrepancia `decimal(12,2)` vs `*_cents` por escritura manual en DB | Ninguna exposición pública a la DB; todas las escrituras via Actions | Bajo |
| Tabla `audit_logs` crece sin tope | `hospital:prune-audit-logs` corre diario a 03:15 con `HOSPITAL_AUDIT_RETENTION_DAYS=365` | Bajo |
| Tabla `idempotency_keys` crece sin tope | Sin prune actualmente. **Recomendación:** agregar `hospital:prune-idempotency-keys` con TTL 7-30 días | MEDIO (documentar) |

## Conclusión

La integridad de la base de datos es **sólida** para piloto:

- Foreign keys restrict previenen borrados inválidos.
- UNIQUE constraints previenen estados imposibles.
- Locks pesimistas serializan las operaciones críticas.
- Transacciones DB garantizan atomicidad.
- Money en centavos enteros previene drift de punto flotante.

Sin defectos bloqueantes conocidos.
