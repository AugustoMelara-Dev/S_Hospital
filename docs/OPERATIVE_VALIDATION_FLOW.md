# Flujo de validacion operativa - Sistema de Caja Hospitalaria

## Objetivo

Validar que el sistema puede operar sin internet en red local: el cajero inicia sesion, abre caja, crea factura, aplica reglas de servicios, cobra, imprime recibo institucional, reimprime y revisa el reporte diario segun permisos.

## Datos de validacion sugeridos

- Usuario cajero: cuenta temporal creada por el administrador para pruebas controladas.
- Usuario supervisor: cuenta temporal con permisos de supervision.
- Paciente: `Maria Lopez`.
- Caja inicial: `500.00`.
- Servicios:
  - `Glucosa`.
  - `Hemograma Completo`.
  - `Eritropoyetina`.
- Configuracion fiscal de validacion:
  - Hospital: `Hospital San Isidro`.
  - RTN: el RTN definido por administracion.
  - CAI y rango: los datos fiscales autorizados o valores temporales marcados como pendientes mientras no se opere en produccion.
- Recibo: media carta como base, con opciones carta y A5.

Las cuentas usadas para validar no deben quedar activas con contrasenas conocidas. Antes de uso real debe existir un administrador inicial con password temporal y cambio obligatorio en primer login, o un procedimiento local documentado equivalente.

## Guion operativo

### 1. Login cajero

Accion:

- Entrar a `/login`.
- Iniciar sesion con una cuenta de cajero autorizada.

Resultado esperado:

- El panel muestra estado de caja.
- No aparecen opciones de usuarios, respaldos ni configuracion fiscal si el cajero no tiene esos permisos.

Nota:

- Si el usuario tiene `must_change_password=true`, el sistema debe bloquear la operacion normal y exigir cambio de password antes de abrir caja o facturar.

### 2. Abrir caja

Accion:

- Ir a Caja.
- Presionar abrir caja.
- Ingresar monto inicial `500.00`.

Resultado esperado:

- Caja queda abierta para el cajero.
- El sistema permite facturar/cobrar.
- Se registra movimiento de apertura.

### 3. Crear factura

Accion:

- Ir a Nueva factura.
- Ingresar paciente `Maria Lopez`.

Resultado esperado:

- Nombre de paciente es obligatorio.
- La factura no se puede emitir sin al menos un servicio.

### 4. Buscar servicio

Accion:

- Buscar `Glucosa`.
- Buscar `Hemograma`.

Resultado esperado:

- El buscador filtra servicios activos.
- Cada servicio muestra area/categoria y precio.
- El cajero no puede editar precio.

### 5. Seleccionar servicios

Accion:

- Agregar `Glucosa`.
- Agregar `Hemograma Completo`.

Resultado esperado:

- Los servicios aparecen en el resumen.
- Totales se previsualizan.
- Al emitir, el backend recalcula y guarda snapshots.

### 6. Eritropoyetina normal

Accion:

- Agregar `Eritropoyetina` sin marcar receta de dialisis.

Resultado esperado:

- Precio aplicado: `25.00`.
- Item muestra regla normal, sin descuento por dialisis.

### 7. Eritropoyetina con receta de dialisis

Accion:

- En otra factura o en el flujo de prueba, agregar `Eritropoyetina`.
- Marcar `paciente con receta de dialisis`.

Resultado esperado:

- Precio aplicado: `0.00`.
- Item registra `special_rule_applied`.
- Recibo muestra la regla aplicada sin exponer codigos internos.

### 8. Emitir factura

Accion:

- Presionar emitir factura.

Resultado esperado:

- Se genera numero fiscal atomico.
- Se valida CAI activo, fecha limite y rango cuando aplique.
- Factura queda emitida con saldo pendiente.
- Items guardan snapshots de nombre, categoria, precio, impuesto y total.

### 9. Cobrar

Accion:

- Presionar cobrar.
- Metodo: efectivo.
- Monto: total de factura.

Resultado esperado:

- Pago queda asociado a factura, caja, cajero, metodo y fecha.
- Se crea movimiento de caja.
- Factura queda pagada con saldo L.0.00.

### 10. Imprimir recibo institucional

Accion:

- Abrir recibo institucional.
- Seleccionar media carta, carta o A5.
- Imprimir una factura a la vez.

Resultado esperado:

- Recibo muestra Gobierno, Secretaria, Hospital San Isidro, numero/serie, fecha, paciente o enterante, concepto, total, pagado, saldo, cajero, metodo de pago, firma y sello.
- El recibo usa fondo blanco, aun cuando la aplicacion este en modo oscuro.
- No imprime QR, codigo de barras, codigos internos ni datos tecnicos.

### 11. Reimprimir factura

Accion:

- Ir a historial.
- Buscar la factura por paciente o numero.
- Presionar reimprimir.
- Registrar motivo.

Resultado esperado:

- Reimpresion usa snapshots historicos.
- Se registra auditoria de reimpresion.

### 12. Ver reporte diario

Accion:

- Entrar con supervisor o administrador.
- Ir a Reportes.
- Abrir reporte diario.

Resultado esperado:

- Reporte separa facturado, cobrado, saldo, parciales, anuladas y metodos de pago.
- Totales coinciden con pagos y caja.
- Cajero no puede ver reporte gerencial si no tiene permiso.

## Criterio de exito

El flujo es aceptable cuando se puede ejecutar en navegador local sin internet y sin intervencion tecnica: login, caja, factura, regla de eritropoyetina, pago, recibo institucional, reimpresion y reporte diario.
