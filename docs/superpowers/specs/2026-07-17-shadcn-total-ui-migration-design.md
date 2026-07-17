# Migración total de UI a shadcn/ui

Fecha: 2026-07-17
Estado: diseño aprobado para implementación
Alcance: frontend completo, tablas operativas, gráficos y recibos institucionales

## 1. Decisión

S_Hospital migrará toda su interfaz a shadcn/ui con el preset oficial
`radix-nova`, React 19 y Tailwind CSS 4. La dirección visual será la estética
moderna estándar de shadcn: radios visibles, mayor espacio, jerarquía clara,
superficies suaves y controles cómodos, adaptada a la densidad necesaria para
caja hospitalaria.

La migración eliminará Ant Design, `@ant-design/icons`, AG Grid y ECharts.
TanStack Table compondrá las tablas de datos con componentes shadcn y Recharts
compondrá los gráficos mediante shadcn Chart. No habrá convivencia permanente
entre los sistemas anteriores y el nuevo.

El backend, los contratos API y las reglas de negocio no cambiarán como parte
de esta migración. Las mejoras generales de Laravel se auditarán y diseñarán
como un subproyecto posterior. Solo se permitirán correcciones backend durante
la migración cuando sean necesarias para mantener un contrato o flujo de UI.

## 2. Objetivos

- Unificar la aplicación bajo un único sistema visual mantenible.
- Eliminar imports, proveedores, temas y adaptadores de las librerías retiradas.
- Conservar todos los flujos de facturación, pago, caja, reportes, catálogo,
  configuración, usuarios, respaldos e impresión.
- Mantener WCAG 2.2 AA como objetivo verificable.
- Mantener producción completamente operativa sin internet dentro de la LAN.
- Mejorar la UI de recibos guardados, vista previa, impresión y reimpresión.
- Ejecutar fases pequeñas, verificables y commiteables.

## 3. Fuera de alcance

- Cambiar reglas fiscales, impuestos, dinero, permisos o numeración.
- Recalcular facturas o recibos históricos desde configuración actual.
- Reescribir contratos API que ya cumplen los flujos.
- Introducir servicios cloud, CDN o activos remotos.
- Mezclar el refactor general del backend con los commits de migración visual.
- Añadir bloques de registros comunitarios sin una necesidad aprobada.

## 4. Arquitectura objetivo

```text
frontend/src/
  components/ui/          componentes oficiales shadcn copiados al repositorio
  design-system/
    patterns/             PageHeader, RouteState, DataTable, Chart y formularios
    tokens/               color, radio, espaciado, tipografía y densidad
  features/               pantallas y componentes por módulo
  shell/                  sidebar, barra contextual y navegación móvil
```

### 4.1 Fundación shadcn

- Inicializar shadcn dentro de `frontend` con `radix-nova` y el alias `@/`.
- Mantener `frontend/src/styles.css` como hoja global y fuente de tokens.
- Usar únicamente componentes del registro oficial de shadcn.
- Guardar todo el código de los componentes en el repositorio.
- Usar tokens semánticos; no fijar colores de marca en cada pantalla.
- Mantener tema claro y oscuro mediante clase local y preferencias existentes.
- Usar Lucide como biblioteca de iconos configurada por shadcn.
- Usar Sonner para notificaciones transitorias.
- Mantener React Hook Form y Zod para formularios.

### 4.2 Patrones institucionales

El design system no duplicará controles generales. Solo contendrá patrones con
semántica real del producto:

- encabezado de página y acciones primarias;
- estados de ruta: carga, vacío, error, sin permiso y no encontrado;
- tabla institucional basada en TanStack Table;
- gráfico institucional basado en Recharts;
- importes en lempiras con números tabulares;
- identidad del hospital;
- marcos de vista previa e impresión de recibos;
- campos y confirmaciones de operaciones sensibles.

## 5. Mapa de sustitución

| Implementación actual | Implementación objetivo |
|---|---|
| Button, Input, Select, Checkbox y Switch de Ant | equivalentes shadcn |
| Form y validación visual de Ant | React Hook Form, Zod y Field |
| Modal | Dialog o AlertDialog |
| Drawer | Sheet o Drawer según contexto responsive |
| Dropdown y Menu | DropdownMenu |
| Tabs y Collapse | Tabs, Accordion o Collapsible |
| Card, Statistic y Descriptions | composiciones shadcn semánticas |
| Alert, Result, Empty, Spin y Skeleton | Alert, Empty, Spinner y Skeleton |
| mensajes mediante AntApp | Sonner |
| DatePicker | Popover y Calendar |
| navegación Ant | Sidebar, Breadcrumb, Command y Sheet |
| InstitutionalDataGrid y AG Grid | TanStack Table y shadcn Data Table |
| InstitutionalChart y ECharts | Recharts y shadcn Chart |
| iconos de Ant | Lucide |

Los adaptadores temporales solo existirán durante la migración de un módulo y
se retirarán antes de cerrar esa fase.

## 6. Tablas de datos

TanStack Table cubrirá las capacidades usadas actualmente: definición tipada
de columnas, ordenamiento, filtrado, visibilidad, selección, acciones por fila
y paginación controlada. La paginación del servidor seguirá siendo la fuente
de verdad cuando ya exista en el contrato API.

El patrón `DataTable` incluirá:

- encabezados ordenables y nombres accesibles;
- columnas prioritarias para anchos pequeños;
- acciones por fila mediante DropdownMenu;
- importes alineados y tabulares;
- estados loading, empty y error;
- paginación con controles shadcn;
- navegación completa por teclado;
- tabla semántica cuando el volumen no necesite virtualización.

Si una prueba con datos reales demuestra que una tabla necesita virtualización,
se añadirá TanStack Virtual en esa tabla concreta. No se añadirá por anticipado.

## 7. Gráficos

Los gráficos actuales de tendencia y métodos de pago migrarán a Recharts. El
patrón institucional envolverá `ChartContainer`, configuración semántica,
tooltip, leyenda, estados y resumen textual.

Todo gráfico conservará una tabla o resumen accesible alternativo. Los colores
procederán de tokens CSS y no serán la única forma de distinguir series. Los
gráficos respetarán `prefers-reduced-motion` y se adaptarán a móvil, impresión
o exportación cuando corresponda.

## 8. Recibos guardados e impresión

El refactor incluye cuatro superficies relacionadas pero separadas:

1. detalle del recibo guardado;
2. vista previa dentro de la aplicación;
3. acciones de imprimir, descargar y reimprimir;
4. documento institucional imprimible/PDF.

La interfaz de aplicación usará shadcn para navegación, acciones, estados y
confirmaciones. El documento imprimible usará HTML semántico y CSS de impresión
propio; no dependerá de Radix ni de widgets interactivos.

### 8.1 Dirección visual del documento

- Cabecera institucional clara con nombre y datos válidos del hospital.
- Número y fecha con jerarquía visible sin dominar el nombre del paciente.
- Nombre del paciente siempre presente.
- Tabla de conceptos legible, con cantidades e importes alineados.
- Subtotal, ISV, descuentos y total agrupados con números tabulares.
- Pagos, método, cajero y fecha visibles según el snapshot guardado.
- Espacio institucional para firma y sello cuando aplique.
- Uso sobrio de líneas, espacio y tipografía; sin tarjetas decorativas.
- Optimización independiente para Carta, Media carta y A5.
- Compatibilidad secundaria de 80 mm y 58 mm sin convertirla en flujo principal.

El recibo no mostrará QR, códigos de barras, identificadores internos ni datos
técnicos. No se recalculará un recibo histórico desde catálogos o configuración
actual. La UI renderizará el snapshot persistido y distinguirá claramente
original, copia y reimpresión.

### 8.2 Comportamiento

- No habrá autoimpresión.
- Imprimir y descargar serán acciones explícitas.
- Reimprimir conservará permisos, motivo y auditoría existentes.
- Un fallo de impresión no insinuará que el pago falló.
- La aplicación permitirá recuperar un recibo pagado desde el historial.
- El CSS de pantalla no contaminará el CSS de impresión.
- Las pruebas compararán contenido y geometría crítica por cada papel.

## 9. Flujos, estado y errores

TanStack Query seguirá manejando estado de servidor. React Hook Form y Zod
manejarán campos y errores locales. La migración no duplicará reglas fiscales
en el navegador.

Cada pantalla conservará estados explícitos de carga, vacío, error, bloqueo por
permiso y éxito. Las mutaciones deshabilitarán acciones repetidas y mostrarán
progreso. Los errores de campo se asociarán al control; los errores operativos
se mostrarán mediante Alert o contenido persistente. Sonner se reservará para
confirmaciones y avisos transitorios, nunca como único lugar para un error que
requiera una decisión del operador.

Los diálogos y paneles devolverán el foco a su activador. Toda confirmación
destructiva o sensible tendrá título, descripción, acción explícita y opción de
cancelar. No se usará `window.alert`.

## 10. Accesibilidad y responsive

- Objetivo WCAG 2.2 AA comprobado con axe y pruebas manuales de teclado.
- Foco visible, orden lógico y enlace para saltar al contenido.
- Targets táctiles de al menos 44 CSS px en acciones principales.
- Etiquetas, descripciones y errores programáticamente asociados.
- Diálogos, sheets y drawers con título accesible.
- Contraste suficiente en claro y oscuro.
- Números financieros con cifras tabulares.
- Sin scroll horizontal de página a 320, 390, 768, 1024, 1366 y 1440 px.
- Tablas con estrategia responsive explícita, no columnas ilegibles comprimidas.
- Movimiento reducido cuando el sistema lo solicite.

## 11. Rendimiento y operación offline

- Carga diferida por rutas para módulos pesados.
- Recharts cargado únicamente en rutas con gráficos.
- TanStack Table sin virtualización salvo evidencia de necesidad.
- Fuentes, iconos, componentes y activos empaquetados localmente.
- Ninguna llamada a CDN o API externa en producción.
- Presupuesto inicial y total medido antes y después de cada retiro de librería.
- Eliminación de paquetes legacy solo cuando sus imports sean cero.

## 12. Estrategia de migración

1. Fundación shadcn, tokens, tema, Sonner y guards arquitectónicos.
2. Shell, navegación, autenticación y estados compartidos.
3. Nueva factura, carrito, confirmación, cobro y recibos.
4. Caja, movimientos, cierre e historial de facturas.
5. Catálogo y TanStack Data Table.
6. Reportes y Recharts.
7. Usuarios, permisos, configuración fiscal, respaldos, ayuda y soporte.
8. Eliminación final de Ant Design, AG Grid, ECharts y adaptadores temporales.
9. Certificación integral y evidencia visual responsive.

Cada fase tendrá un commit Conventional Commit independiente y dejará verdes
sus pruebas focalizadas. No se mezclarán módulos no relacionados.

## 13. Pruebas

### Componentes e integración

- Tests de componentes shadcn institucionales y sus variantes.
- Formularios: validación, envío, foco y errores por campo.
- Dialog, Sheet, Drawer, menús y command palette por teclado.
- DataTable: orden, filtros, paginación, columnas, acciones y estados.
- Chart: datos, tooltip, leyenda, estado y alternativa accesible.
- Recibos: snapshot histórico, paciente, importes, copias y acciones.

### E2E

- Login y cambio obligatorio de contraseña.
- Apertura de caja.
- Factura normal y eritropoyetina con y sin receta.
- Pago total y parcial.
- Impresión explícita en Carta, Media carta y A5.
- Recuperación y reimpresión auditada del recibo guardado.
- Historial, anulación, cierre de caja y reportes.
- Catálogo, usuarios, permisos y respaldo manual.
- Navegación responsive y comprobación axe en flujos críticos.

### Gates por fase

```text
npm run typecheck
npm run lint
npm run test
npm run build
npm run check:ui-rules
npm run budget:bundle
```

Se añadirán guards que fallen si aparecen nuevos imports de `antd`,
`@ant-design/icons`, `ag-grid-*` o `echarts` en módulos migrados. El gate final
exigirá cero imports y cero dependencias de esas librerías.

## 14. Riesgos y mitigaciones

- **Regresión funcional amplia:** migración vertical y pruebas por flujo.
- **Mezcla visual prolongada:** retirar adaptadores al cerrar cada módulo.
- **Pérdida de densidad:** variantes compactas para caja y tablas, sin abandonar
  el espaciado moderno en el resto de la aplicación.
- **Pérdida de funciones de AG Grid:** caracterizar cada consumidor antes de
  migrarlo y añadir TanStack Virtual solo si las mediciones lo exigen.
- **Diferencias gráficas:** validar etiquetas, escalas, totales y alternativas
  tabulares, no solo capturas.
- **Cambios en recibos históricos:** renderizar snapshots guardados y añadir
  pruebas de regresión de primera copia y reimpresión.
- **Bundle temporalmente mayor:** medir por fase y retirar dependencias al llegar
  a cero consumidores.
- **Cambios locales preexistentes:** no sobrescribir `package-lock.json` ni las
  capturas QA; integrar únicamente los cambios necesarios después de revisar
  su diff.

## 15. Criterios de aceptación

- `package.json` no contiene Ant Design, iconos Ant, AG Grid ni ECharts.
- No quedan imports, proveedores, temas, CSS ni adaptadores de esas librerías.
- Toda la aplicación usa shadcn/ui y tokens semánticos.
- Todas las tablas operativas usan TanStack Table o HTML semántico justificado.
- Todos los gráficos usan Recharts con alternativa accesible.
- Recibos guardados, vista previa, impresión y reimpresión tienen la nueva UI.
- Carta, Media carta y A5 conservan contenido, corte y legibilidad.
- El recibo principal no muestra QR, código de barras ni códigos internos.
- Facturación, pago, caja, impresión, reimpresión y reportes funcionan de punta
  a punta.
- TypeScript, ESLint, Vitest, build, E2E, axe y presupuesto de bundle pasan.
- La aplicación funciona sin internet desde otra computadora de la LAN.
- No se perdieron cambios locales preexistentes.

## 16. Subproyecto posterior de backend

Después de certificar la migración UI se realizará una auditoría separada de
Laravel. Cubrirá controladores, Form Requests, Policies, Actions/Services,
transacciones, consultas, índices, dinero, auditoría, backups y pruebas. Cada
hallazgo necesitará evidencia, riesgo, criterio de aceptación y un commit por
dominio. Esta especificación no autoriza una reescritura indiscriminada del
backend.
