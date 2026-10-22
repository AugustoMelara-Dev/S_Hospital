# Original User Request

## 2026-09-28T04:02:03Z

Reconstruir e integrar integralmente la interfaz, documentos y operación del Sistema de Caja del Hospital General San Isidro adoptando la estructura de cuenta continua de la Propuesta A depurada, bajo una identidad visual sobria y unificada en Azul y Blanco (#2563EB) y neutros, cubriendo todas las secciones del sistema (Acceso, Resumen, Cobrar, Recibos, Caja, Reportes, Administración y Comprobantes).

Working directory: `C:\Projects\S_Hospital_AI`
Integrity mode: development
Reference mandate: `hospital-ai/MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md`

## Requirements

### R1. Identidad Visual Unificada (Azul, Blanco y Neutros) y Shell Operativo
- Implementar la paleta canónica: Primario `#2563EB`, Hover/Pressed `#1D4ED8`, Superficie `#FFFFFF`, Fondo `#F8FAFC`, Texto principal `#0F172A`, Texto secundario `#475569`, Bordes/Líneas `#E2E8F0`, Selección suave `#EFF6FF`.
- Sin verde como segunda marca, sin morado para EPO y sin mezcla de estilos entre módulos. Cumplir contraste WCAG 2.2 AA.
- Retirar de las rutas operativas el laboratorio de propuestas, selector A/B, tarjetas explicativas de diseño y textos de depuración.
- Shell de navegación con sidebar de escritorio y barra/cajón móvil integrado en las rutas normales (`/resumen`, `/cobrar`, `/recibos`, `/caja`, `/reportes`, `/admin`), excluyendo del build de entrega los bypasses de desarrollo.
- Aplicar rigurosamente las skills `better-ui` y `emil-design-eng`: radio concéntrico (`outer = inner + padding`), alineación óptica, `active:scale-[0.96]` en botones principales, cifras tabulares con símbolo de moneda unido (`L. 15.00`) y respeto de `prefers-reduced-motion`.

### R2. Estación de Cobro (Cuenta Continua Depurada)
- Conservar la secuencia ergonómica de la Propuesta A: Paciente → Búsqueda/Inserción → Líneas Ledger → Resumen Monetario → Cobro.
- Solo *Nombre del paciente* como dato personal requerido. Una nueva operación arranca vacía, sin paciente heredado y sin condición EPO preactivada.
- Búsqueda amplia por nombre y código interno con navegación por teclado y ratón; un `Enter` en la búsqueda agrega el concepto seleccionado sin disparar el cobro. Accesos frecuentes opcionales respaldados exclusivamente por el catálogo real.
- Tabla contable continua: descripción, cantidad editable mediante stepper táctil accesible, precio unitario de catálogo, ajuste de gratuidad e importe de línea.
- Regla EPO: la condición se explica una sola vez con lenguaje institucional claro («Sin cobro por receta»). La gratuidad aplica exclusivamente al medicamento elegible; los demás productos de la cuenta conservan su tarifa habitual. No exponer códigos internos de backend ni carteles de marketing.
- El servidor es la única autoridad monetaria; validación exacta en centavos, prevención de doble envío e idempotencia estricta. Separar claramente el cobro confirmado de la acción posterior de imprimir comprobante.

### R3. Recibos e Historial de Operaciones
- Búsqueda por paciente, número correlativo, fecha y estado.
- Paginación robusta, visualización del detalle de la cuenta, cobro de saldos cuando aplique y reimpresión auditada con motivo obligatorio.
- Anulaciones y reversiones controladas por permisos y registradas en auditoría.
- Adaptabilidad responsive sin recortar columnas ni ocultar acciones críticas.

### R4. Gestión de Caja, Movimientos y Arqueo
- Apertura de turno con fondo inicial, asociación a caja física y operador.
- Registro de movimientos, desglose por métodos de pago (Efectivo, Tarjeta, Transferencia).
- Arqueo con conteo discriminado: diferenciar esperado, contado y diferencia; permitir conteo deliberado de cero y distinguir pendiente de verificado.
- Cierre de caja con balance conciliado y reporte de sesión.

### R5. Reportes Operativos, Ejecutivos, PDF y Excel
- Períodos y filtros consistentes distinguiendo estrictamente fecha de emisión, fecha de cobro y fecha de corte.
- Exportación en **PDF Ejecutivo**: resumen institucional, indicadores clave, tablas con encabezados repetidos en saltos de página y diseño limpio optimizado para escala de grises y ahorro de tinta.
- Exportación en **Excel (.xlsx)** con libros de trabajo estructurados: hojas *Resumen*, *Operaciones*, *Detalle*, *Cobros* y *Caja*, con valores numéricos reales (no texto para importes), fechas formateadas, códigos con ceros preservados y sanitización contra inyección de fórmulas.

### R6. Comprobante Hospitalario para Impresora Convencional
- Perfiles de impresión oficiales: Carta vertical (612×792 pt) y Media Carta nativa horizontal (612×396 pt), además de soporte A4/A5.
- Estructura limpia y compacta: datos de la institución, fecha y número correlativo, nombre del paciente destacado, detalle de líneas con precios y ajustes, desglose de impuestos/exenciones, importe en letras y espacio para firma/sello.
- Sin códigos técnicos, QR ni mensajes decorativos.
- Vista previa fiel que no consume correlativo ni duplica transacciones.

## Acceptance Criteria

### Integridad Visual y Estilística
- [ ] La paleta `#2563EB` domina la aplicación; no existen acentos verdes o violetas como marcas secundarias en Cobrar ni en el resto de las vistas.
- [ ] La barra de laboratorio, el selector A/B y los textos de justificación del diseño han sido retirados de las rutas operativas normales.
- [ ] `better-ui` y `emil-design-eng` aplicados: cifras con `tabular-nums`, radio concéntrico en tarjetas y contenedores, botones con escala táctil uniforme `scale(0.96)`.

### Funcionalidad y Reglas de Negocio
- [ ] Al iniciar una nueva operación en Cobrar, los campos arrancan vacíos sin heredar paciente previo ni condición de diálisis.
- [ ] En una cuenta mixta (EPO + Glucosa/otros), la gratuidad aplica únicamente a la línea elegible y el total suma exactamente los conceptos cobrables.
- [ ] El servidor valida precios y montos; un fallo de red o popup bloqueado en la impresión no duplica el cobro ni altera el correlativo fiscal.
- [ ] Flujo completo verificado en navegador real desde login hasta cierre de caja y reimpresión de comprobante.

### Calidad Técnica y Entregables
- [ ] `npm run typecheck` en el frontend y pruebas de backend pasan con 0 errores.
- [ ] Archivos PDF y Excel exportados desde la UI verificados y guardados en evidencias.
- [ ] Capturas de pantalla directas del navegador a resolución real (1440×900 y 390×844) de las vistas operativas principales sin cabeceras de laboratorio.
