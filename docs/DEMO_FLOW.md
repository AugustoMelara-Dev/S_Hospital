# Demo Flow - Sistema de Caja Hospitalaria

## Objetivo

Demostrar un flujo vendible temprano sin internet: cajero inicia sesion, abre caja, crea factura, aplica reglas de servicios, cobra, imprime recibo institucional, reimprime y revisa reporte diario.

## Datos demo sugeridos

- Usuario cajero:
  - username: `cajero.demo`
  - password: definida por seeder/dev docs.
- Usuario supervisor:
  - username: `supervisor.demo`
- Paciente:
  - `Maria Lopez`
- Caja inicial:
  - `500.00`
- Servicios:
  - `Glucosa`
  - `Hemograma Completo`
  - `Eritropoyetina`
- Configuracion fiscal demo:
  - Hospital: `Hospital Demo`
  - RTN: `08011999123456`
  - CAI: `DEMO-CAI`
  - Rango: `000-001-01-00000001` a `000-001-01-99999999`
- Recibo: `80mm`

Estas credenciales demo solo pueden existir en desarrollo. Produccion no debe entregarse con usuarios demo activos. Antes de uso real debe existir un admin inicial con password temporal y cambio obligatorio en primer login, o un procedimiento local documentado equivalente.

## Guion operativo

### 1. Login cajero

Accion:

- Entrar a `/login`.
- Iniciar sesion con `cajero.demo`.

Resultado esperado:

- El panel muestra estado de caja.
- No aparecen opciones de usuarios, backups ni configuracion fiscal.

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
- Cada servicio muestra categoria y precio.
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
- Recibo muestra nota/regla aplicada.

### 8. Emitir factura

Accion:

- Presionar emitir factura.

Resultado esperado:

- Se genera numero fiscal atomico.
- Se valida CAI activo, fecha limite y rango.
- Factura queda Emitida con saldo pendiente.
- Items guardan snapshots de nombre, categoria, precio, impuesto y total.

### 9. Cobrar

Accion:

- Presionar cobrar.
- Metodo: efectivo.
- Monto: total de factura.

Resultado esperado:

- Pago queda asociado a factura, caja, cajero, metodo y fecha.
- Se crea movimiento de caja.
- Factura queda Pagada con saldo L.0.00.

### 10. Imprimir recibo institucional

Accion:

- Abrir preview de recibo.
- Seleccionar ancho `80mm`.
- Imprimir.

Resultado esperado:

- Recibo muestra hospital, RTN, CAI/rango si estan configurados, numero de factura, fecha, cajero, paciente, items, subtotal, impuesto, total y pagos.
- Formato no sale como hoja carta principal.

### 11. Reimprimir factura

Accion:

- Ir a historial.
- Buscar la factura por paciente o numero.
- Presionar reimprimir.

Resultado esperado:

- Reimpresion usa snapshots historicos.
- Se registra auditoria de reimpresion.

### 12. Ver reporte diario

Accion:

- Entrar con supervisor o admin.
- Ir a Reportes.
- Abrir reporte diario.

Resultado esperado:

- Reporte muestra total cobrado del dia.
- Totales coinciden con pagos y caja.
- Cajero no puede ver reporte gerencial si no tiene permiso.

## Criterio de exito demo

La demo es aceptable cuando el flujo completo se puede ejecutar en navegador local sin internet y sin intervencion tecnica: login, caja, factura, regla de eritropoyetina, pago, recibo, reimpresion y reporte diario.
