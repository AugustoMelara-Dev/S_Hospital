# Terminología y flujos de pantalla (UI en español es-HN)

Montos: "L 1,234.00" (fuente mono, cifras tabulares). Total no confirmado por el servidor: "No disponible" (nunca L 0.00).

## Navegación
Resumen · Cobrar · Recibos · Caja · Reportes · Administración (Catálogo y precios, Usuarios y permisos, Ajustes institucionales, Respaldos, Auditoría) · Ayuda · Salir.
Barra superior: estado de caja permanente ("Caja abierta · desde 07:02" / "Sin caja abierta" → botón "Abrir caja"), usuario y rol, botón Buscar (Ctrl K).
Inicio: rol cajero → `/cobrar`; resto → `/` (Resumen).

## Login
"Iniciar sesión" · "Usuario o correo" · "Contraseña" (Mostrar/Ocultar, aviso "Bloq Mayús está activo") · botón "Iniciar sesión" → "Comprobando acceso…".
Bloqueo: "Demasiados intentos. Espere 15 minutos." Cambio obligatorio: "Proteja su cuenta" (Contraseña actual, Nueva, Confirmar; ≥12 con mayúscula, minúscula, número y símbolo) → "Actualizar contraseña".

## Resumen
KPIs del día: **Facturado**, **Cobrado**, **Saldo pendiente**, **Operaciones sin cobro**. "Cobros por método". "Operaciones recientes" (Documento, Hora, Paciente, Estado, Total). Panel "Atención ahora": pendientes de cobro, recibos faltantes, o "No hay pendientes".

## Cobrar (punto de venta, flujo de teclado)
1. **Nombre del paciente** (obligatorio, autofocus; "Ingrese el nombre del paciente."). Único dato personal.
2. **Agregar conceptos**: buscador "Nombre o código" (debounce, ≤30 resultados, ↑/↓, Enter agrega, Esc cierra; tras agregar el foco vuelve al buscador), filtro Categoría, "Accesos rápidos". Agregar un concepto repetido suma 1 a la cantidad.
3. **Cuenta**: Concepto (badge "Sin cobro por receta"), Cantidad (− / + y decimal ≤2), Precio unitario, Ajuste, Importe, Quitar.
4. Si hay un concepto con la regla de eritropoyetina y el usuario tiene permiso: casilla **"Paciente con receta de diálisis"** — "Aplica solo al medicamento elegible; el resto conserva su precio."
5. **Total** (vía `/invoices/preview` en cada cambio): Subtotal, Exento, ISV 15 %, **Total**; estados Borrador · Calculando… · Listo para cobrar · "Abra caja antes de emitir y cobrar". Botones "Vista previa" (PDF borrador) y **"Cobrar · L x"** (o "Emitir sin cobro" si total 0).
6. **Confirmar cobro** (diálogo): Paciente, conceptos, totales, **Método de pago** (Efectivo, Transferencia, Tarjeta, Otro). Efectivo: "Efectivo recibido", botón "Monto exacto", **Cambio** en vivo; si es menor: "El monto recibido es menor que el total a cobrar." Referencia (obligatoria en tarjeta/transferencia).
7. Resultado: "Operación cobrada" — Documento, paciente, total, método, cambio; botones **Imprimir recibo**, **Guardar PDF**, **Nueva operación** (F2).

## Recibos
Filtros: "Paciente o número", Desde/Hasta, Estado (Pendiente de cobro, Pago parcial, Pagada, Emitida sin cobro, Anulada). Tabla: Documento, Fecha, Paciente, Total, Saldo, Estado, Acciones.
Detalle: líneas, totales (Total, Pagado, Saldo, Subtotal, Exento, ISV), Pagos, Comprobante (número, reimpresiones). Acciones: Imprimir recibo, Reimprimir (motivo; "No genera cobros ni números nuevos."), Cobrar saldo / Registrar abono, **Anular** (solo sin pagos; "Motivo de anulación", "Esta acción no se puede deshacer."), **Revertir** (con pagos; "Motivo de reversión").

## Caja
Sin sesión: "Apertura de caja" — Caja física, **Monto inicial (L)** ("Puede ser L 0.00"), confirmar → "Caja abierta."
Con sesión: Apertura, Cobros registrados, Saldo pendiente; pestañas **Resumen** (cobros por método; solo efectivo entra a gaveta), **Movimientos** (Hora, Tipo, Referencia, Método, Monto), **Arqueo** (billetes L 500/200/100/50/20/10/5/2/1 × cantidad + "Monedas y otros"; Efectivo esperado, Total contado, Diferencia: Sobrante/Faltante/Cuadra), **Cierre** (bloqueos con enlace "Resolver en Recibos"; "Nota de cierre" obligatoria con diferencia; diálogo "Cierre de caja" → "Resumen de cierre" con Imprimir resumen).
Histórico de caja: filtros Desde/Hasta, Caja, Operador, Diferencia (Todas/Cuadradas/Faltante/Sobrante).

## Reportes
Período: Hoy, Ayer, 7 días, Este mes, Mes anterior, Personalizado (≤92 días). Filtros: Método, Estado, Cajero, Caja/turno, Categoría. Botones Exportar PDF / Exportar Excel.
Resumen: Facturado, Cobrado, Saldo, Sin cobro, Ticket promedio, Anulado, Reversado, Líneas gratuitas. Pestañas: Operaciones, Detalle, Cobros, Caja, Gratuidades. Gráfica diaria (Facturado vs Cobrado).

## Administración
- **Catálogo y precios**: buscar, Categoría, Estado; tabla Producto o servicio, Categoría, Área, Precio, Impuesto, Estado. Panel lateral "Nuevo/Editar concepto" (Nombre, Categoría, Área, Precio, Tasa de impuesto/Exento, Activo, Visible en caja, Facturable; motivos de cambio). "Historial de precios". "Impuesto en lote". "Importar / Exportar". Categorías y Áreas.
- **Usuarios y permisos**: tabla Usuario, Rol, Estado, Último acceso; Crear/Editar (Nombre completo, Usuario, Correo, Contraseña inicial, Rol), Restablecer clave (motivo), Activar/Desactivar (motivo). Roles: lista + editor de permisos por módulo.
- **Ajustes institucionales**: pestañas Identidad (Nombre del hospital, RTN, Dirección, Teléfono, Lema, Dependencia superior, Secretaría, Lugar del recibo, Texto al pie, Logo), Numeración fiscal (Prefijo, CAI, Válido hasta, Desde, Hasta, Correlativo actual; chips Vigente/Vencida, Rango por agotarse ≤100), Impuestos (tasas), Reglas de cobro ("Permitir abonos parciales"), Impresión (perfil predeterminado, copias, serie de recibo, texto legal, "PDF de prueba").
- **Respaldos**: Último exitoso, Crear respaldo, historial (Fecha, Tipo, Tamaño, Estado, Descargar).
- **Auditoría**: filtros Usuario, Acción, Desde/Hasta; columnas Fecha y hora, Acción, Responsable, Resultado (Correcto/Fallido/Denegado), Motivo.

## Recibo institucional (PDF)
Encabezado: logo opcional, Dependencia superior, Secretaría, **nombre del hospital**, dirección, lugar, "RTN · Tel.". Banda: "RECIBO INSTITUCIONAL", leyenda de copia (ORIGINAL / PRIMERA COPIA / SEGUNDA COPIA), "REIMPRESIÓN #n" si aplica; a la derecha "Recibo No." en el color de la serie.
Datos: Factura, Fecha, Paciente, Cajero, Caja, CAI, Rango autorizado, Fecha límite de emisión. Tabla "Detalle de servicios": Descripción, Cant., Precio, Ajuste, Importe. Totales: Subtotal, Exento, Gravado 15 %, ISV 15 %, **Total**, Pagado, Saldo, **Monto en letras**. Pagos: Método, Referencia, Monto. Pie: "Firma del enterante" | "Sello y firma autorizada", texto legal, texto al pie. Sin QR ni códigos de barras.
