# Integridad de Backend y Datos - 07 Backend Integrity

- **Sistema**: S_Hospital
- **Fecha**: 2026-07-22

## Verificación de Reglas Negociables de Backend

1. **Snapshots Monetarios Históricos**: Las facturas guardan precios y descripciones en `invoice_items`. Nunca se recalculan facturas históricas desde el catálogo actual.
2. **Uso de Transacciones DB**: Mutaciones de facturas, pagos, aperturas/cierres de caja y anulaciones operan dentro de `DB::transaction()` con bloqueo de pesimismo cuando corresponde.
3. **Regla de Eritropoyetina**: Medicamento de L.25, gratuito (L.0.00) si se indica que el paciente posee receta de diálisis activa.
4. **Validaciones Server-Side**: Form Requests y Policies/Gates verificados en Laravel. Las acciones no autorizadas retornan 403 HTTP.
