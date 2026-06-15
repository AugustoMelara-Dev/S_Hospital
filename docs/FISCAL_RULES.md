# Fiscal Rules - Sistema de Caja Hospitalaria

## Objetivo

Modelar desde fases tempranas la configuracion fiscal hondurena necesaria para emitir facturas con correlativo, CAI, RTN, rango autorizado y fecha limite. Una validacion local puede usar datos temporales, pero esos datos deben estar configurados en la secuencia fiscal igual que los datos reales y no deben confundirse con autorizacion fiscal final.

## Datos fiscales configurables

Configuracion de hospital:

- Nombre comercial/legal.
- RTN.
- Direccion.
- Telefono opcional.
- Mensaje de recibo.
- Tasa de impuesto por defecto.
- Formato de recibo por defecto: media carta; el selector operativo muestra media carta, carta, A5, 80mm o 58mm.

Secuencia fiscal:

- Tipo de documento: `invoice`.
- Prefijo: ejemplo `000-001-01`.
- Correlativo actual.
- Rango minimo autorizado.
- Rango maximo autorizado.
- CAI.
- Fecha limite de emision.
- Estado activo/inactivo.

## Reglas de emision

- No emitir factura real ni de validacion si no existe secuencia fiscal activa y valida para `invoice`.
- No emitir factura si el CAI esta vacio.
- No emitir factura si la secuencia esta inactiva.
- No emitir factura si `valid_until` esta vencida.
- No emitir factura si el siguiente correlativo es menor que `min_number`.
- No emitir factura si el siguiente correlativo es mayor que `max_number`.
- No permitir duplicar `invoice_number`.
- No permitir bajar `current_number` por debajo de un numero ya emitido.
- No permitir borrar una factura con items. `invoice_items.invoice_id` debe usar
  `restrictOnDelete()` para que una eliminacion manual no borre detalle historico fiscal.
- Si una validacion local usa CAI temporal, ese CAI debe estar guardado en la configuracion fiscal antes de emitir y debe quedar marcado como pendiente de autorizacion real.
- Si una regla autorizada deja una factura en L.0.00, la factura puede quedar `paid` sin crear un pago artificial de L.0.00. La trazabilidad obligatoria queda en la factura, caja, cajero, snapshots y auditoria `invoice.zero_amount_registered`. No debe aumentar efectivo esperado, pagos cobrados ni recaudacion.

## Correlativo atomico

La reserva del correlativo debe ocurrir dentro de la misma transaccion que crea la factura. No existe flujo valido donde se reserve o incremente el correlativo fuera de esa transaccion.

Flujo obligatorio:

1. Iniciar transaccion.
2. Bloquear fila de `fiscal_sequences` con `SELECT ... FOR UPDATE` o equivalente Eloquent.
3. Validar secuencia activa, CAI no vacio, rango y fecha limite.
4. Calcular siguiente numero.
5. Crear factura e items snapshot.
6. Actualizar `current_number`.
7. Confirmar transaccion.

No se debe reservar correlativo antes de crear la factura. Si falla la creacion, no debe quedar un numero consumido salvo que una decision fiscal futura exija registrar numeros anulados/no usados.

## Calculo de ISV

El backend calcula el ISV a nivel de factura, no redondeando cada linea de
forma independiente:

```text
tax_cents = round(total_taxable_cents * tax_rate / 100)
```

Cuando el recibo o el detalle necesitan mostrar impuesto por linea, el backend
prorratea `tax_cents` con largest remainder: primero asigna la parte entera de
cada linea y luego distribuye los centavos restantes a las lineas gravadas con
mayor residuo. La suma de `invoice_items.tax_amount_cents` debe coincidir
exactamente con `invoices.tax_amount_cents`.

Casos protegidos por prueba:

- 10 lineas de L.0.50 al 15% generan ISV L.0.75.
- 1 linea de L.5.00 al 15% genera ISV L.0.75.
- Canastas fiscalmente equivalentes generan el mismo total.

## Formato de numero de factura

Formato recomendado:

```text
{prefix}-{number padded 8 digits}
```

Ejemplo:

```text
000-001-01-00000001
```

El formato final debe ser centralizado en backend. El frontend solo muestra el numero recibido.

## Datos fiscales en factura y recibo

Factura/recibo debe mostrar si estan configurados:

- Nombre del hospital.
- RTN.
- CAI.
- Rango autorizado.
- Fecha limite.
- Numero de factura.
- Fecha y hora de emision.
- Cajero.
- Nombre del paciente.

Si una validacion local usa datos fiscales temporales, deben existir en configuracion fiscal y no quedar hardcoded en el recibo.

## Auditoria

Auditar:

- Creacion o edicion de secuencias fiscales.
- Cambio de CAI.
- Cambio de rango.
- Cambio de fecha limite.
- Emision de factura.
- Fallo de emision por CAI vencido/fuera de rango, cuando sea relevante para soporte.

## Casos de prueba obligatorios

- Emite factura con CAI activo y rango valido.
- Bloquea emision con CAI vacio.
- Bloquea emision con CAI vencido.
- Bloquea emision con secuencia inactiva.
- Bloquea emision fuera de rango.
- Dos emisiones concurrentes reciben numeros distintos.
- Recibo muestra RTN/CAI/rango cuando estan configurados.
