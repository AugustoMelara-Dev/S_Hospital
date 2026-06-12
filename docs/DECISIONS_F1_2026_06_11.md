## 2026-06-11 - POS usa contrato operativo de facturacion visible y receta a nivel factura

### Contexto

El backend ya trabajaba con dos reglas operativas que el frontend no estaba reflejando de forma consistente:

1. El catalogo separa visibilidad en caja (`visible_in_billing`) de facturabilidad (`is_billable`).
2. La receta de dialisis (`dialysis_prescription`) pertenece al nivel de la factura, no al nivel de cada item.

Antes de F1/F1.1 el frontend todavia mezclaba ambos conceptos: ocultaba parte del estado operativo real del servicio y seguia propagando `dialysis_prescription` dentro de los items.

### Decision

- El endpoint que recibe la emision de factura es `POST /api/invoices`.
- El payload final mantiene `dialysis_prescription` solo en la raiz:

```json
{
  "patient_name": "Maria Lopez",
  "dialysis_prescription": true,
  "items": [
    {
      "service_id": 123,
      "quantity": "1.00",
      "notes": null
    }
  ]
}
```

- `dialysis_prescription` no se duplica dentro de `items`.
- El POS consume `visible_in_billing` para decidir si un servicio aparece en caja.
- El POS consume `is_billable` para decidir si el servicio visible puede agregarse o si debe mostrarse bloqueado con motivo explicito.

### Razon de contrato

`dialysis_prescription` vive a nivel `invoice/root` porque la regla de negocio aplica al contexto general de la emision y a la autorizacion del emisor, no a un item aislado. El backend resuelve esa bandera en `CreateInvoiceAction` y la valida contra el permiso `patients.mark_dialysis_prescription` antes de calcular reglas especiales como eritropoyetina gratis.

Moverla a item-level sin cambio de contrato duplicaria semantica, abriria estados ambiguos dentro de una misma factura y obligaria a rehacer validaciones, calculo de totales y pruebas de autorizacion.

### Verificacion

- Frontend:
  - `frontend/src/features/invoices/NewInvoiceView.test.tsx`
    - confirma que el `POST /api/invoices` incluye `dialysis_prescription` en la raiz
    - confirma que `postedItems[0]` no incluye `dialysis_prescription`
- Backend:
  - `backend/tests/Feature/Billing/InvoiceDialysisPrescriptionTest.php`
    - cubre factura gratis de eritropoyetina cuando la bandera va en raiz y el usuario tiene permiso
    - cubre rechazo `422` cuando un cajero sin permiso intenta enviar `dialysis_prescription: true`
  - `backend/tests/Feature/InvoiceCreationTest.php`
  - `backend/tests/Feature/CashPaymentsReceiptTest.php`

### Riesgo futuro

Si en el futuro se necesitara receta por item, eso debe tratarse como cambio de contrato backend y no como refactor frontend. Antes de mover la bandera a item-level habria que:

1. redefinir `StoreInvoiceRequest` y `CreateInvoiceAction`
2. actualizar calculo de reglas especiales
3. ajustar permisos y auditoria
4. agregar pruebas frontend y backend especificas del nuevo contrato
