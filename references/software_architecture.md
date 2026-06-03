# Referencia: arquitectura de software para Sistema de Caja Hospitalaria

## Principios obligatorios

### SOLID
- Single Responsibility: controllers no deben calcular facturas, cerrar caja ni aplicar reglas fiscales. Deben delegar a Actions/Services.
- Open/Closed: agregar categorías o métodos de pago no debe obligar a reescribir facturación completa.
- Liskov/Interface Segregation/Dependency Inversion: usar contratos solo cuando aporten valor; no crear interfaces vacías por ceremonia.

### DRY
- Una sola fuente de verdad para cálculo final: backend.
- Frontend puede previsualizar, pero el total guardado lo calcula el backend.
- No duplicar queries de reportes en múltiples controllers; usar query objects o services.

### KISS
- Paciente solo nombre. No construir expediente clínico.
- Sistema offline LAN, no sincronización cloud compleja.
- Factura simple con snapshots, no motor contable completo.

### YAGNI
- No inventar inventario de medicamentos si el cliente solo pidió cobrar medicamentos.
- No hacer multi-sucursal si no fue pedido.
- No hacer app móvil nativa.

## Arquitectura sugerida
- Laravel API como backend central.
- React + TypeScript como frontend.
- MySQL/MariaDB local.
- Services/Actions para dominio: CreateInvoiceAction, RegisterPaymentAction, CloseCashboxAction, VoidInvoiceAction.
- Policies para permisos.
- Form Requests para validación.
- Resources para responses API.

## Antipatrones bloqueantes
- Lógica de caja en React.
- Facturas que consultan precio actual de service al imprimir una factura vieja.
- Borrar facturas en lugar de anular.
- Implementar módulos enormes sin commits pequeños.
