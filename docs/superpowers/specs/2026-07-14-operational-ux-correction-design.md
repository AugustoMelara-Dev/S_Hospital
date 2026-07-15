# S_Hospital — Corrección UX real y rediseño operativo

Fecha: 2026-07-14

Estado: diseño aprobado para planificación

## 1. Decisión de producto

S_Hospital recibirá una corrección operativa completa guiada por evidencia en
navegador. El objetivo no es preservar la composición integrada en julio de
2026, sino conservar únicamente los contratos de negocio y las piezas técnicas
que demuestren servir al trabajo hospitalario.

La entrega conserva React con TypeScript estricto, Ant Design, Ant Design
Icons, AG Grid Community, Apache ECharts, React Hook Form, Zod, TanStack Query,
Day.js, Laravel y MySQL/MariaDB. La aplicación seguirá funcionando sin internet
en una LAN. El radio global seguirá siendo cero.

Esta especificación sustituye, para este trabajo, cualquier dirección anterior
que proponga ShadCN, Radix, Lucide, Recharts u otro framework visual. Los
contratos fiscales, de permisos, auditoría, pagos, caja, idempotencia e
impresión existentes continúan siendo fuente de verdad.

## 2. Evidencia inicial y problema observado

El repositorio está en `main` y el último merge contiene una refactorización
operativa amplia. Las capturas versionadas en `qa/refactor/screenshots` muestran
que la integración no satisface el nuevo criterio de aceptación:

- facturación mantiene tarjetas anidadas, etiquetas editoriales redundantes,
  carrito ancho y notificaciones que cubren contenido;
- historial desperdicia el primer viewport, trunca identificadores y presenta
  una tabla con densidad y adaptación insuficientes;
- caja apila resúmenes, alertas y formularios verticales antes de movimientos;
- catálogo desplaza la tarea principal mediante métricas decorativas y comprime
  información operativa en una tabla extensa;
- shell y páginas repiten ubicación, títulos, estado de caja e identidad;
- la documentación de certificación existente no sustituye una inspección
  fresca en navegador.

Hasta recibir otra ubicación, `qa/refactor/screenshots` y
`frontend/artifacts/frontend-final/screenshots` serán el baseline provisional.
La matriz canónica provisional de doce comparaciones será: login, Dashboard,
facturación vacía, facturación con cuenta, cobro en efectivo, recibo Carta,
historial, caja abierta, cierre de caja, catálogo, configuración institucional y
configuración de recibos. Si aparece el conjunto original solicitado, sustituirá
esta selección sin cambiar los criterios de medición ni los layouts aprobados.

## 3. Estrategia de entrega

El trabajo se organiza en entregas verticales. Cada entrega reproduce el
problema, añade una prueba que lo detecta, corrige la experiencia, verifica el
resultado en navegador y termina en un commit Conventional Commit coherente.

1. **Baseline reproducible:** navegador, red, API y base de datos.
2. **Núcleo operativo:** login, shell, facturación, cobro y recibo.
3. **Operación tabular:** historial, caja y catálogo.
4. **Administración:** configuración, usuarios, reportes y respaldos.
5. **Cierre:** documentos, accesibilidad, rendimiento, capturas y gates.

No se ejecutará una reescritura simultánea de todas las rutas. Tampoco se
aceptarán arreglos cosméticos que dejen intactos scrolls anidados, tiempos de
respuesta, jerarquía o tareas fuera del primer viewport.

## 4. Baseline y contrato de observación

Antes de modificar una ruta se capturará su estado con datos sembrados reales
en 1920×1080, 1366×768, 1024×768, 768×1024, 390×844 y 320×568. Se añadirán
ejecuciones equivalentes a 125 % y 200 % de zoom.

Cada captura generará un registro estructurado con:

- rectángulo y posición de paneles relevantes;
- ancho del documento y existencia de overflow horizontal;
- contenedores con overflow vertical y elementos sticky;
- controles cubiertos o fuera del viewport;
- truncado, idioma, paginadores y acción primaria visible;
- `console.error`, `pageerror` y `requestfailed`;
- duración de solicitudes y duplicados por método, ruta y payload.

Playwright producirá JSON y screenshots, pero la evidencia se revisará también
visualmente. El baseline no se sobrescribe: las capturas finales se almacenan
en un directorio separado y un índice HTML o Markdown muestra antes y después.

## 5. Investigación de rendimiento LAN

Se instrumentarán `POST /api/auth/login`, `GET /api/system/setup-status`, la
sesión Sanctum y la consulta de servicios de facturación. La medición separará
DNS/conexión, espera del servidor, transferencia y render del cliente.

En Laravel se registrarán consultas por petición con duración, repetición y
caller en un entorno de diagnóstico local. Las consultas lentas se validarán
con `EXPLAIN`; ningún índice se añadirá por intuición. También se comprobarán el
servidor PHP usado en LAN, workers, locks de sesión y transacciones abiertas.

En React se auditarán claves de TanStack Query, invalidaciones, `enabled`,
reintentos, efectos y montaje bajo Strict Mode. Una solicitud duplicada solo se
considerará corregida cuando la traza de red demuestre una única intención
lógica.

El presupuesto es inferior a dos segundos para login y consultas críticas con
datos sembrados. Ninguna solicitud normal debe aproximarse al timeout existente
de diez segundos. Aumentar timeouts no es una solución válida.

## 6. Identidad institucional

La identidad textual canónica será:

> Hospital General San Isidro  
> Tocoa, Colón, Honduras

Se buscará un activo oficial únicamente en archivos controlados por el
hospital, la Secretaría de Salud o documentación administrativa verificable.
Mientras no exista, se usará un wordmark tipográfico marcado como identidad
provisional. No se dibujará una cruz ni se reutilizará el logo de otra
institución.

El componente de marca aceptará el activo administrado desde Branding y
mantendrá una caja de proporción estable. Login, shell, vista previa y PDF usarán
el mismo origen, sin acoplar layouts a dimensiones concretas del futuro logo.

## 7. Shell operativo

El shell tendrá una sola jerarquía de ubicación. La navegación lateral reducirá
su ancho efectivo y no tendrá scroll propio cuando las opciones disponibles
quepan. El encabezado contendrá únicamente ubicación actual, caja, búsqueda,
ayuda y usuario.

Las páginas no repetirán el título del encabezado con múltiples eyebrow,
breadcrumb y H1 equivalentes. El estado de caja se mostrará una vez en el shell
y solo reaparecerá dentro de una ruta cuando sea parte de una decisión.

La jerarquía provendrá de espacio, tipografía y superficies. Los bordes se
reservan para separar controles, regiones interactivas o datos tabulares. El
rail conserva foco visible, estado activo, nombres accesibles y navegación por
teclado. En móvil pasa a navegación compacta sin reducir el ancho útil de la
tarea.

## 8. Facturación responsive-first

### 8.1 Estructura

En escritorio desde 1280 px habrá dos columnas: una principal flexible y una
cuenta de 360–420 px. El documento tendrá una sola barra vertical. La cuenta
será sticky solo mientras quepa; si crece, participa del scroll principal y su
acción queda disponible mediante una franja segura.

Entre 768 y 1279 px no habrá columna lateral. La cuenta vivirá en un Drawer
accesible y una barra inferior mostrará cantidad, total y “Ver cuenta”. Por
debajo de 768 px la pantalla será de una columna, las categorías cambiarán a un
Select o carril horizontal controlado y el Drawer ocupará la pantalla.

El padding inferior del contenido se calculará según la barra persistente. Las
pruebas verificarán geométricamente que ningún sticky cubra campos, cantidades,
errores o resultados.

### 8.2 Paciente y servicios

Paciente será una sección compacta con nombre obligatorio y datos opcionales
bajo revelado progresivo. Nombre, búsqueda y primeros resultados deben entrar
en 768 px de alto.

Cada servicio será una fila completa activable con clic, Enter o lector. Enter
en la búsqueda agregará el primer resultado elegible. Categoría y área no se
duplicarán cuando representen el mismo texto. Disponibilidad, código y estado
solo aparecerán cuando ayuden a decidir.

Los resultados usarán paginación o carga incremental sobre el scroll de página.
No habrá una lista con scroll vertical dentro de un documento que ya desplaza.

### 8.3 Cuenta

La cuenta presentará nombre, cantidad editable, importe, subtotal, ISV y total
en una tabla compacta. El total tendrá énfasis tipográfico, no un bloque de
color que oculte líneas. La acción será “Emitir y cobrar”.

Las validaciones aparecerán junto al campo correspondiente y un resumen breve
solo enlazará errores múltiples. El frontend puede previsualizar; el backend
continúa calculando y confirmando importes. La regla de eritropoyetina permanece
en el contrato actual y se comunica sin reinterpretarla.

## 9. Cobro

El diálogo o Drawer de cobro ordenará visualmente TOTAL, RECIBIDO y CAMBIO. En
efectivo ofrecerá Exacto, L100, L200 y L500, validación inmediata y cambio como
cifra principal. Para tarjeta y transferencia ocultará recibido y cambio y
mostrará referencia.

El control de envío quedará deshabilitado durante la mutación. La clave de
idempotencia se conserva a través de reintentos de una misma intención y cambia
solo para una nueva operación. Un error preserva los datos y explica si es
seguro reintentar.

## 10. Factura y recibo

La vista previa y el PDF consumirán un único modelo de presentación. El
documento incluirá marca, institución, ubicación, RTN, dirección, teléfono,
número, fecha, estado, paciente, cajero, caja, servicios, cantidades, precio,
ISV, importe, subtotal, exentos, impuestos, total, monto en letras, método de
pago, tipo de copia, firma, sello e información fiscal aplicable.

Carta, Media Carta y A5 tendrán plantillas administrativas específicas. Una
factura de cuatro servicios deberá ocupar una página sin expulsar totales y
firmas cuando exista espacio. Los perfiles de 80 mm y 58 mm serán plantillas
separadas de compatibilidad y no escalados de Carta.

El navegador renderizará cada formato a PDF durante las pruebas. Se verificará
número de páginas, caja de totales, área de firma, cortes de filas y paridad de
contenido entre vista previa y salida.

## 11. Grids e historial

`InstitutionalDataGrid` será el único patrón de AG Grid para escritorio. La
paginación pertenecerá al servidor o al grid, nunca a ambos. Todos los textos se
localizarán a español de Honduras, incluida la selección de tamaño de página.

Historial asignará ancho flexible a Paciente, cifras tabulares alineadas a la
derecha y una columna de acciones siempre disponible. Fecha y hora usarán
Day.js con locale `es-HN`. La altura será `autoHeight` o calculada por contenido
para conjuntos pequeños; dos registros no producirán un lienzo vacío enorme.

En 1366 px no habrá overflow horizontal del documento. En tablet y móvil el
grid se reemplazará por lista operativa con los campos y acciones esenciales,
no por todas las columnas comprimidas.

El patrón se aplicará a Caja, Catálogo, Usuarios, Reportes y Respaldos, con
columnas y acciones propias del dominio.

## 12. Caja y catálogo

Caja abrirá con una cabecera operativa compacta: estado, apertura, efectivo
esperado, pendiente y acciones. Se eliminará la alerta verde que repite un
estado ya visible. Los movimientos traducirán `opening` a “Apertura”, evitarán
columnas redundantes y mostrarán la referencia completa en un detalle
accesible. Cada bloqueo de cierre tendrá “Resolver en historial” junto a él.

Catálogo mostrará filtros y registros en el primer viewport. Se retirarán las
métricas decorativas y la representación duplicada de categorías. Nombre,
área, categoría y código distinguirán servicios homónimos. Móvil utilizará una
lista operativa. Alta y edición conservarán los schemas y contratos existentes.

## 13. Configuración y demás módulos

Configuración tendrá navegación local por Hospital, Numeración, Operativa,
Marca y Recibos. Se eliminarán títulos duplicados, bordes accidentales y cajas
de resumen sobredimensionadas. Estado y acción ocuparán filas compactas. El
guardado sticky existirá solo mientras haya cambios sin guardar.

Usuarios, Reportes y Respaldos adoptarán la misma regla del primer viewport:
la tarea principal y sus filtros deben ser visibles antes de resúmenes
secundarios. Los charts solo se usarán cuando una relación visual aporte más
que una cifra o tabla. Ningún módulo expondrá controles sin implementación o
sin autorización backend.

## 14. Login, Dashboard y estados parciales

Login mostrará “Validando credenciales” en un estado neutral, mantendrá la
geometría del formulario e impedirá doble envío. Una alerta roja solo aparecerá
después de una respuesta de error real.

Dashboard cargará sus bloques de manera independiente. Un fallo de
`setup-status` mostrará un error contextual con reintento pequeño, pero no
reemplazará métricas y acciones disponibles. Los estados parciales deben
mantener landmarks, foco y lectura coherentes.

## 15. Accesibilidad e interacción

El objetivo es WCAG 2.2 AA en flujos críticos. Se verificará teclado completo,
foco inicial y restaurado en Drawer/Modal, labels persistentes, anuncios no
duplicados, objetivos táctiles, contraste, reduced motion y reflow a 200 %.

Los drawers móviles no perderán el contexto que los abrió. Cerrar la cuenta
devuelve el foco a “Ver cuenta”; cerrar el cobro devuelve el foco a la acción de
emisión cuando la operación no terminó.

## 16. Pruebas y evidencia obligatoria

Se añadirán pruebas que fallen con el estado previo para demostrar:

- cero overflow horizontal en todos los viewports;
- máximo un scroll vertical principal en facturación;
- cuenta y acción primaria sin cubrir controles;
- acción primaria visible o disponible mediante barra persistente;
- cambio visible en efectivo y ausente cuando no aplica;
- una sola paginación y cero términos ingleses;
- loading de login sin severidad de error;
- fallo de `setup-status` sin destruir Dashboard;
- factura corta en una página;
- fila de servicio activable con clic y Enter.

Vitest cubrirá lógica y componentes; Storybook, estados aislados; Playwright,
geometría, navegación, red, axe y screenshots; el navegador PDF, impresión. Se
ejecutarán también typecheck, lint, build y el gate legacy estricto.

Cada entrega tendrá gates focales. El cierre ejecutará todos los comandos
normativos de `AGENTS.md`. Los tests no bastan para aceptar una entrega: las
capturas y PDFs se inspeccionan visualmente y se documenta el veredicto.

## 17. Criterios de aceptación y trazabilidad

La matriz de cierre relacionará cada requisito con una evidencia autoritativa:
test, traza de red, consulta SQL, screenshot, PDF o inspección manual firmada.
No se marcará una fila como cumplida mediante un test que no cubra su alcance.

La entrega completa exige:

- facturación usable a 320, 390, 768, 1024, 1366 y 1920 px;
- cero controles cubiertos, overflow horizontal o scroll traps;
- acción primaria y cuenta disponibles sin perder la búsqueda;
- factura corta de una página y plantillas térmicas independientes;
- historial y demás grids con una sola paginación y español completo;
- login y consultas críticas por debajo de dos segundos con datos sembrados;
- Caja, Catálogo y Configuración con la tarea principal en el primer viewport;
- identidad auténtica o explícitamente provisional y reemplazable;
- comparación lado a lado claramente superior de las doce capturas acordadas;
- gates automatizados frescos y revisión visual completa;
- ninguna dependencia cloud, CDN, wrapper temporal o segundo framework visual;
- ningún merge final mientras falte una fila de evidencia.

## 18. Riesgos y controles

- **Documentación contradictoria:** esta especificación registra explícitamente
  qué decisiones anteriores quedan sustituidas.
- **Pruebas verdes que preservan defectos:** primero se añaden aserciones de
  geometría, contenido y comportamiento observables.
- **Cambios visuales que rompen negocio:** servicios, hooks y contratos API se
  conservan; las reglas fiscales siguen verificándose en backend.
- **Entorno Docker lento o no disponible:** se diagnostica el runtime; no se
  oculta con timeouts mayores ni se presenta un mock como evidencia LAN.
- **Logo no verificable:** se usa wordmark provisional y se registra la fuente
  pendiente sin bloquear layouts.
- **Alcance amplio:** cada entrega vertical termina con evidencia propia y no
  mezcla módulos no relacionados en un commit.
