# Flujo Operativo Hospitalario

## Objetivo

Este documento define como debe operar el Sistema de Caja Hospitalaria para Hospital San Isidro cuando se trabaja con caja, recepcion y areas administrativas que consumen servicios cobrados.

El alcance es administrativo y de facturacion. No registra expediente clinico, diagnosticos, resultados de laboratorio, inventario medico ni citas.

## Flujo actual detectado

El sistema ya soporta el modo de caja unica como flujo principal:

1. El cajero inicia sesion en el servidor local por navegador.
2. El cajero abre su caja.
3. En Nueva factura ingresa el nombre del paciente.
4. Busca servicios por nombre, categoria o codigo si el scanner esta habilitado.
5. Agrega servicios al carrito.
6. El backend emite la factura, reserva correlativo fiscal y guarda snapshots de items.
7. El cajero registra pago con metodo y referencia cuando aplica.
8. El sistema asocia factura, pago, caja, cajero y fecha.
9. El recibo institucional se genera desde snapshots historicos.
10. Historial y reportes consultan datos persistidos, no precios actuales del catalogo.

El catalogo maneja categorias, areas administrativas, servicios, precios, estado activo/inactivo, codigos opcionales, alias de busqueda, visibilidad de facturacion y regla especial de eritropoyetina.

## Flujo recomendado para Hospital San Isidro

### Modo A: Caja unica

Este es el modo principal del MVP y debe permanecer como camino rapido.

Caja registra paciente, selecciona servicios, cobra e imprime. Es el modo mas simple para operar si el hospital centraliza los cobros en una ventanilla.

### Modo B: Area solicita, caja cobra

Un area administrativa puede preparar o referir una solicitud simple de cobro para caja. Caja siempre cobra e imprime.

Este modo no debe incluir resultados medicos, diagnosticos ni expediente clinico. Si se implementa, debe ser una cola administrativa de cobro, no un modulo medico.

### Modo C: Caja cobra y area consulta

Caja factura y cobra. Luego el area correspondiente puede ver una lista de servicios pagados para atender.

Ejemplo: Laboratorio ve que un paciente pago un examen. La vista del area solo muestra informacion administrativa minima: fecha, paciente, servicio pagado, estado de pago, numero de recibo y observacion administrativa si existe.

Implementado:

- Ruta de usuario de area: `/area-services`.
- API: `GET /api/area-services/paid`.
- Permiso: `area_services.view`.
- Rol semilla: `usuario_area`.
- Cada usuario de area debe tener `service_area_id` asignado.

## Areas administrativas

Las areas iniciales recomendadas son:

- Laboratorio
- Rayos X
- Emergencia
- Consulta externa
- Farmacia, solo como servicios cobrables y sin inventario
- Otros

Cada area debe poder activarse o desactivarse. Cada servicio puede pertenecer opcionalmente a un area.

El punto de venta permite filtrar servicios activos, visibles y cobrables por area para que caja encuentre rapido servicios de Laboratorio, Rayos X, Emergencia, Consulta externa, Farmacia u Otros.

## Reglas de privacidad y permisos

- Cajero: factura, cobra, imprime y reimprime segun permisos.
- Usuario de area: consulta servicios pagados de su area; no cobra, no edita precios, no anula y no ve caja completa.
- Supervisor: revisa reportes y operaciones autorizadas.
- Administrador: gestiona catalogo, areas, usuarios, configuracion y respaldos.
- Auditor: consulta sin modificar.

El backend debe validar todos los permisos. Ocultar botones en React no es seguridad suficiente.

## Catalogo maestro

El catalogo debe evolucionar para guardar, como minimo:

- Nombre claro.
- Categoria.
- Area/departamento opcional.
- Precio.
- Estado activo/inactivo.
- Alias de busqueda.
- Descripcion corta opcional.
- Codigo interno opcional solo administrativo.
- Si requiere impresion en recibo.
- Si aparece en facturacion.

Los recibos para paciente deben imprimir nombres de servicio desde snapshots, no codigos internos.

## Reportes por area

Los reportes administrativos deben separar:

- Facturado.
- Cobrado.
- Saldo pendiente.
- Anuladas.
- Parciales.

Cuando una factura tenga servicios de varias areas, los reportes por area deben calcularse desde `invoice_items` y sus snapshots, no desde el servicio actual del catalogo.

Implementado:

- API: `GET /api/reports/areas`.
- UI: Reportes > Areas.
- Filtros compartidos con reportes por rango: fechas, categoria, cajero, caja, metodo y estado.
- Totales por area: facturas, items, subtotal, ISV, facturado, cobrado y saldo.

## Criterios de aceptacion del frente operativo

- Caja unica sigue funcionando sin pasos extra.
- El catalogo puede asignar area a servicios sin romper facturas antiguas.
- La busqueda tolera tildes, mayusculas, alias y abreviaturas razonables.
- Usuario de area solo ve servicios pagados de su area.
- Reportes por area salen del backend y no recalculan en React.
- No se crea expediente clinico ni inventario medico.
- La operacion sigue siendo offline LAN.
