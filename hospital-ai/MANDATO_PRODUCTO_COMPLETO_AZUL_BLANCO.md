# S_HOSPITAL — DIRECCIÓN AZUL Y BLANCO + PRODUCTO COMPLETO

## 0. Propósito y decisión de diseño
Este texto adopta la estructura de cuenta continua de la Propuesta A, depurada, y la convierte en el sistema real. No construir una tercera alternativa ni conservar dos modos de cobro como productos permanentes.
El alcance es el Sistema de Caja del Hospital General San Isidro: acceso, Resumen, Cobrar, Recibos, Caja, Reportes y Administración, incluidos documentos y operación local. No es un CRM, comercio electrónico, historia clínica, sistema de aseguradoras ni una plataforma SaaS. El prompt del CRM es referencia de calidad de producto, interacción, autonomía y verificación, no de módulos comerciales.
La meta combina nuevo diseño aplicado a todas las vistas y funcionamiento completo. Ni una interfaz bonita con datos ficticios ni un backend probado detrás de la interfaz rechazada cumplen la misión.
Raíz escribible de la campaña: `C:\Projects\S_Hospital_AI`.

## 1. De las propuestas al producto
- Conservar de A la secuencia paciente → búsqueda/inserción → líneas → revisión monetaria → cobro. La cuenta y sus líneas forman un área de trabajo continua; no convertirla en una hoja de papel artificialmente estrecha ni dividir cada concepto en una tarjeta grande.
- De B se puede tomar únicamente la comodidad de unos pocos accesos frecuentes, siempre respaldados por el catálogo real. No trasladar su identidad verde, su lenguaje de «comanda táctica», las tarjetas repetidas para toda la cuenta ni un catálogo hardcodeado.
- Separar la aplicación de su presentación comparativa. Retirar de las rutas operativas la barra de «Laboratorio de dirección visual», selector A/B, switches de fixtures, tarjetas explicativas, frases en inglés y secciones que justifican el diseño.
- No se entrega una URL /propuestas como sustituto de /cobrar. Integra el diseño en las rutas normales con datos y acciones reales. Verifica que las antiguas rutas permitidas lleven al destino correcto y no a una interfaz abandonada.

## 2. Una identidad: azul, blanco y neutros
Paleta centralizada en los tokens canónicos:
- Acción y selección principales: `#2563EB`
- Estado hover/pressed del mismo azul: `#1D4ED8`
- Superficie principal: `#FFFFFF`
- Fondo general: `#F8FAFC`
- Texto principal: `#0F172A`
- Texto secundario: `#475569`
- Separadores: `#E2E8F0`
- Estado seleccionado tenue: `#EFF6FF`

Sin verde como segunda marca, sin morado para EPO y sin mezcla de identidades entre secciones.
Los avisos y acciones peligrosas pueden conservar un color semántico discreto cuando ayude, acompañado de texto/icono. El producto debe ser inteligible también en escala de grises.
Tipografía sans local y coherente, cifras tabulares para dinero, símbolo e importe juntos. Texto de trabajo alrededor de 14–16 px, títulos proporcionados, controles cómodos. Una familia de iconos, alineación óptica y estados uniformes. No forzar fuente monoespaciada en todo importe.

## 3. Las dos skills se usan de verdad
Obligatorias:
- `jakubkrehel/skills/better-ui`
- `emilkowalski/skills/emil-design-eng`
Aplicar las recetas de superficie, iconos y feedback de Better UI; utilizar Emil para decidir cuándo una interacción merece movimiento y cómo mantener coherencia. Para feedback presionado: `scale(0.96)` con variante estática. No animar repetitivamente la edición de importes o el teclado, y respetar movimiento reducido.

## 4. Cobrar: especificación de la estación
### Paciente y nueva operación
- Solo Nombre del paciente es dato personal obligatorio. Sin documento, diagnóstico, expediente, dirección, correo ni teléfono. No usar «Paciente responsable» si el dato es simplemente el nombre del paciente.
- Una nueva operación comienza vacía, sin paciente heredado y con condición EPO no confirmada. No heredar la autorización por receta de la operación previa.
### Agregar y revisar
- Búsqueda amplia por nombre y referencias reales; navegación de resultados con teclado y ratón. Un Enter en la búsqueda agrega el resultado seleccionado, no cobra.
- Frecuentes opcionales respaldados por el catálogo real.
- Tabla de cuenta: descripción, cantidad, precio unitario, ajuste cuando corresponda e importe. Nombre completo visible; importes alineados.
### Regla EPO
- La selección de receta se explica una vez con lenguaje sencillo. La línea beneficiada lleva «Sin cobro por receta» y muestra el ajuste correctamente.
- No mostrar al cajero `ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION`, «Regla activa», «Cobertura 100%» o «Ahorro» como marketing. No convertir gratuidad en una supuesta exención fiscal.
- Código de regla y autorización evaluados en servidor. El efecto se aplica solo a líneas de medicamentos elegibles. Los otros servicios/productos mantienen su importe y tratamiento autorizado.
- Precio, nombre y presentación proceden del catálogo autorizado.
### Valorar y cobrar
- Backend como autoridad monetaria, con representación exacta e invariantes verificadas. Separar dinero interno de texto localizado.
- Distinguir: cuenta vacía, cálculo pendiente, error de cálculo, total positivo, total cero autorizado, operación pendiente de pago y operación ya registrada. Cero en una cuenta vacía no significa emitir gratis.
- Revisión integrada de paciente, líneas, total y método antes de confirmar. Botón final muestra importe vigente.
- Efectivo, transferencia o tarjeta según métodos habilitados.
- Si falla el PDF o se cancela imprimir, no volver a cobrar ni emitir otro número. Separar cobro de impresión.

## 5. Todas las secciones del menú son alcance funcional
- **Acceso y sesión:** Login, cambio de contraseña cuando corresponda, logout, expiración y permisos efectivos; misma identidad de formulario.
- **Resumen:** Período y ámbito claros, facturación/cobros/saldo según sus definiciones, operaciones sin cobro separadas de ingresos, pendientes accionables y actividad reciente. Sin hero promocional ni gráficos de relleno.
- **Cobrar:** Recorrido completo del apartado 4, confirmado en datos reales de laboratorio.
- **Recibos:** Buscar por nombre/número/fecha/estado, paginar, abrir detalle, cobrar saldo permitido, visualizar/descargar/imprimir/reimprimir y anular o revertir según permisos.
- **Caja:** Apertura, caja física y operador, movimientos, métodos, arqueo, diferencia y cierre; histórico accesible y conciliación correcta.
- **Reportes:** Período, filtros autorizados, resumen y desgloses elegibles; PDF/Excel del conjunto filtrado, no solo las filas visibles.
- **Administración:** Catálogo, precios, categorías, usuarios, roles/permisos vigentes, identidad institucional, numeración/impresión y mantenimiento/respaldos simplificados.

## 6. Reportes fiables, PDF y Excel cuidados
- Distinción estricta entre período de emisión, pagos y corte.
- En pantalla mostrar un desglose activo, no cinco tablas extensas una debajo de otra.
- **PDF ejecutivo:** Resumen proporcionado del período, métricas pertinentes y detalle/anexos solicitados. Tipografía legible, diseño limpio y legible en escala de grises con acento azul moderado.
- **Excel:** Hojas requeridas (Resumen, Operaciones, Detalle, Cobros, Caja) con valores monetarios numéricos, conteos enteros, porcentajes formateados, identificadores preservados, y prevención de inyección de fórmulas.

## 7. Comprobante para impresora convencional
- Perfiles principales: carta vertical (612×792 pt) y media carta nativa horizontal (612×396 pt). Mantener A4/A5 cuando correspondan.
- Diseño institucional limpio: institución compacta, tipo/número/fecha, nombre del paciente destacado, líneas con cantidad/precio/ajuste/importe, resumen monetario, método/referencia aplicable, importe en letras referido al concepto correcto y espacio útil de firma/sello.
- Sin códigos técnicos, QR ni mensajes de diseño.

## 8. Operación local y seguridad
- Operación 100% offline en LAN local.
- Si el servidor no responde, no confirmar cobro ficticio.
- Excluir del build productivo y de las rutas de entrega el laboratorio y su excepción de autenticación.

## 9. Casos de aceptación
- EPO con y sin receta/autorización.
- Cuentas vacías, pendientes y errores.
- Cantidades > 1,000 y formatos numéricos exactos.
- Doble clic, Enter en búsqueda, reintentos e idempotencia.
- Fallo de PDF sin duplicación de cobro.

## 10. Implementación coordinada
Distribución entre agentes reales:
1. Shell, acceso y Resumen
2. Cobrar y diálogos
3. Recibos y Caja
4. Reportes y Administración
5. Comprobantes PDF/Excel y backend
6. QA visual e integración independiente
