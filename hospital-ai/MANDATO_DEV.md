# S_Hospital — reconstrucción integral para una sesión NUEVA de Dev

**Encargo:** implementación y sustitución completa de la experiencia anterior; nueva identidad visual; refactor/reconstrucción de frontend, backend, recibos y reportes.
**Entorno solicitado:** OpenCode, con el DeepSeek 4.1 Flash y el proveedor que el usuario tiene seleccionados.
**Fecha del mandato:** 18 de septiembre de 2026.

## 0. Qué debes construir y qué queda autorizado

Eres Dev, responsable principal de esta NUEVA sesión. “Dev” nombra tu función en este encargo: utiliza el agente de desarrollo con edición disponible en la instalación, sin inventar que existe un comando o perfil nativo con ese nombre. No dependes del contexto de una conversación anterior ni de recuperar sesiones antiguas de subagentes. Asume aquí la coordinación de un equipo real y ejecuta este mandato completo.

El producto es el sistema de caja del **Hospital General San Isidro, Tocoa, Colón, Honduras**. El usuario ha rechazado la interfaz anterior, incluidos los rediseños que únicamente cambiaron tamaños, espaciados y colores. La misión NO es mejorar esa misma apariencia: es construir una experiencia nueva y más fácil de usar.

**La nueva UI no hereda el diseño R2.** Debes reemplazar su composición, navegación, jerarquía, tipografía, superficies, componentes de pantalla, estados y comprobantes. Quedan autorizadas la reescritura de módulos completos de frontend y backend, las modificaciones de contratos y esquema que requiera la nueva solución, y la eliminación del código activo sustituido. No necesitas demostrar que una función tiene un bug para reorganizar o reescribir su implementación dentro de este alcance.

Puedes comenzar las implementaciones de los módulos de nuevo, con una arquitectura coherente, en lugar de envolver los anteriores. No hay obligación de conservar el shell, los tokens, los contenedores, los reducers, las pantallas, los servicios ni los generadores actuales. Tampoco hay obligación de cambiar de lenguaje o framework: reutilizar React o Laravel no significa conservar su implementación anterior.

**Eliminar y comenzar de nuevo se refiere a la implementación del producto, no a destruir información.** Antes de sustituir código, conserva un snapshot recuperable del árbol actual, incluidos archivos nuevos necesarios. No borres bases, facturas, pagos, catálogo, cuentas, auditoría, claves, `.git`, respaldos o evidencia del usuario. No hagas commits, push, publicación ni cambios en producción sin autorización específica. El código viejo no debe seguir formando parte de la aplicación entregada: su referencia histórica queda fuera del build y del recorrido operativo.

El resultado será un producto sencillo, no una plataforma nueva: **nombre del paciente → productos/servicios → revisión → cobro o gratuidad válida → comprobante → consulta y reportes**. Español, lempiras HNL y zona operativa America/Tegucigalpa. Una computadora como modo inicial, con varios usuarios y capacidad de clientes simultáneos en red local. Sin dependencia de Internet para la operación central.

No construyas CRM, expediente clínico, SaaS, tienda, suscripciones, asistente IA, constructor universal de plantillas ni un sistema nuevo de facturación de proveedores. El presupuesto reportado es limitado: el alcance se simplifica por funcionalidad, no sacrificando exactitud ni legibilidad.

## 1. Arranque autocontenido: contexto y recuperación, sin otra auditoría interminable

Identifica la raíz escribible, rama, HEAD, diff, archivos no rastreados, procesos y base de laboratorio. La ruta histórica es `C:\Projects\S_Hospital_AI`; el original era `C:\Projects\S_Hospital`. Verifica cuál contiene las fuentes actuales; no ejecutes checkout/reset ni reemplaces el trabajo local por una versión remota antigua.

El stack histórico era Laravel/PHP, React/TypeScript/Vite, MariaDB, Tailwind/primitivas accesibles, TanStack Query, Dompdf y PhpSpreadsheet. Las versiones y rutas actuales se obtienen de los manifiestos y lockfiles; no se fijan copiando un informe viejo.

Lee instrucciones aplicables y el estado reciente del repositorio. `hospital-ai/progreso/ESTADO.md`, los checkpoints C1/R2 y sus evidencias son antecedentes útiles SI existen, no requisitos para comprender o comenzar este mandato. Si faltan, inspecciona el código y continúa. No requieras a la persona copiar informes que puedes leer localmente.

Este mandato sustituye las directrices anteriores de producto que obligaban a preservar la UI, todos los menús, los tokens R2 o tres copias automáticas. Actualiza únicamente las instrucciones de proyecto y comandos que volverían a cargar esas órdenes. Conserva antecedentes marcados como históricos. No alteres políticas superiores de la herramienta ni permisos de producción. El usuario autoriza navegador/Playwright/E2E locales con datos sintéticos para esta reconstrucción; las restricciones antiguas del proyecto que los prohibían no deben volver a bloquearla. Ajusta las reglas de proyecto de forma acotada y verifica los permisos efectivos, sin eludir un bloqueo superior de la herramienta.

Obtén un mapa breve de todas las secciones, también diálogos, rutas poco visibles, impresión y exportación:

`Sección | tarea | rol | ruta/implementación | API/datos | reemplazo/fusión/retirada | destino nuevo | propietario`

Registra además los contratos esenciales: paciente, catálogo, regla de diálisis, operación, pago, caja, recibo y reporte. Esta es ingeniería inversa para reconstruir, no una obligación de mantener lo antiguo. Empieza las tareas independientes cuando tengas sus entradas y salidas identificadas.

Comprueba que el navegador sirve la raíz y el build nuevos. Revisa caché/service worker/perfil persistido con un perfil de prueba limpio. No atribuyas al código nuevo una pantalla servida por otro proceso en los puertos históricos 15173/18080.

## 2. PRIMERA ACCIÓN DE PREPARACIÓN: instala las dos skills y comprueba su carga

**Tienes autorización explícita para instalar o reinstalar estas DOS skills en el proyecto. Hazlo en esta sesión.** No sustituyas la instalación por “ya estaban en una carpeta” ni por un resumen de sus nombres.

Fuentes exactas solicitadas:

- `https://www.skills.sh/jakubkrehel/skills/better-ui`
- `https://www.skills.sh/emilkowalski/skills/emil-design-eng`

Antes de reinstalar, conserva cualquier copia local modificada fuera de las carpetas que escanea OpenCode. Solo se actualizan estas dos skills, no todas las instaladas. Ejecuta, una instalación después de la otra, desde la raíz verificada del proyecto:

```powershell
npx --yes skills add https://github.com/jakubkrehel/skills --skill better-ui --agent opencode --copy --yes
if ($LASTEXITCODE -ne 0) { throw "Falló la instalación de better-ui; revisar la salida real." }

npx --yes skills add https://github.com/emilkowalski/skills --skill emil-design-eng --agent opencode --copy --yes
if ($LASTEXITCODE -ne 0) { throw "Falló la instalación de emil-design-eng; revisar la salida real." }

npx --yes skills list --agent opencode
if ($LASTEXITCODE -ne 0) { throw "No se pudo verificar la lista de skills." }
```

No uses instalación global, `--all`, una búsqueda por un nombre parecido ni un comando de Claude/Codex en sustitución. Comprueba la sintaxis con la ayuda de la versión efectiva si difiere. Estos comandos son para Dev en desarrollo, no requisitos que deba ejecutar el cajero en el hospital.

Si no hay conectividad de desarrollo, utiliza una distribución local completa de esas mismas skills con procedencia comprobada. No inventes que descargaste algo. Un fallo de instalación bloquea la declaración de uso de las skills; continúa tareas independientes mientras resuelves el acceso, sin declarar completado el encargo visual.

Después de instalar, localiza los `SKILL.md` y sus referencias. OpenCode puede descubrir skills en `.opencode/skills/`, `.agents/skills/` y otras raíces compatibles. Verifica el destino que realmente utilizó el CLI y elimina colisiones de descubrimiento sin tocar contenido ajeno. Mantén una revisión canónica y registra ruta y hash.

**Instalada no significa cargada.** Dev y cada autor/revisor visual deben invocar la herramienta nativa `skill` para cargar `better-ui` y `emil-design-eng`, leer las referencias pertinentes y utilizarlas. No imprimas una llamada como texto fingiendo que ocurrió. Verifica que los agentes tienen `skill` habilitada y permiso sobre ambos nombres. Ajusta permisos de proyecto puntuales si es necesario, sin un allow global. Si la versión exige recargar para descubrirlas, realiza la recarga admitida o comunica una única instrucción técnica de reanudación.

Las referencias de `better-ui` sobre superficies, iconos y animaciones se leen cuando correspondan; el contenido completo de Emil también. Ninguna skill autoriza acceder a secretos ni ejecutar scripts ajenos a la tarea.

## 3. Cómo se aplican juntas, SIN conservar el diseño rechazado

La frase genérica de `better-ui` que pide mantener tokens, componentes y densidad existentes se aplica al NUEVO sistema de diseño que vas a construir, no obliga a preservar R2. La sustitución está ordenada expresamente por el propietario.

La condición de Emil de responder únicamente con una frase inicial cuando no hay tarea concreta no aplica: esta sesión sí tiene un encargo concreto.

Prioridad: reglas de negocio explícitas de este mandato, corrección de datos, seguridad y accesibilidad; después la identidad nueva; después las recetas específicas aplicables de las skills. Mantén íntegros los originales de las skills: la resolución de estas condiciones vive en las instrucciones del proyecto.

Aplica acabado de superficies, radios coherentes, alineación óptica, iconografía, estados y transiciones con propósito. Para press feedback ocasional, si corresponde, usa el valor 0.96 de better-ui; para acciones frecuentes de teclado o movimiento reducido, utiliza el comportamiento estático pertinente. No promedies 0.96/0.97 ni conviertas una receta en una animación obligatoria de todos los botones.

La composición, facilidad de uso, tipografía y accesibilidad son responsabilidades explícitas aunque una skill remita esos temas a otra guía. No necesitas instalar diez skills más para cumplirlas. Ambas skills deben notarse en el resultado y en una revisión breve con `Antes | Después | Principio | Evidencia`.

## 4. Equipo real: Dev más doce especialistas, con varios implementadores de UI

Dev sigue siendo el responsable principal de esta sesión. Puedes reutilizar perfiles compatibles existentes, actualizar su encargo o crear los que falten con las capacidades nativas de la versión instalada. No exijas que la persona regrese al antiguo `hs-orchestrator`.

| Especialista / perfil propuesto | Entrega, no solo asesoría |
|---|---|
| `hs-ux` | Nueva identidad, composición de las superficies y revisión visual durante la implementación. |
| `hs-frontend` | Nueva base visual, navegación, login y componentes compartidos; dueño del shell y tokens. |
| `hs-ui-cobro` | Cobrar, paciente, selección, carrito, regla de diálisis, revisión, pago y resultado. |
| `hs-ui-recibos` | Historial de operaciones/recibos, detalle y recuperación/reimpresión; sin duplicar el generador. |
| `hs-ui-caja` | Caja y Resumen, aperturas, movimientos, conciliación y cierre. |
| `hs-ui-reportes` | Reportes simples, filtros, tablas y conexión con exportaciones. |
| `hs-ui-admin` | Catálogo, usuarios y ajustes administrativos mínimos. |
| `hs-receipts` | Plantilla del comprobante, PDF, preview y configuración de impresión. |
| `hs-backend` | Reconstrucción del dominio de cobro, reglas, APIs y generadores PDF/XLSX de reportes. |
| `hs-data-runtime` | Esquema/migraciones, arranque local/LAN, empaquetado, backups y recuperación. |
| `hs-qa` | Regresiones independientes, integración real, accesibilidad y validación de artefactos. |
| `hs-review` | Evaluación independiente funcional y visual; no aprueba su propia implementación. |

No ejecutes doce diseños inconexos. Primero acuerda la identidad, componentes comunes y contratos; después distribuye pantallas. Cada tarea incluye objetivo, contexto autocontenido, entradas/salidas, archivos propios, dependencias y criterios de aceptación. Si alguno de los perfiles se sustituye por uno existente, registra el mapeo y conserva sus límites.

Empieza con cuatro a seis tareas independientes activas y amplía solo cuando los recursos lo permitan. Por los OOM reportados, una sola carga pesada de pruebas/build/navegador al principio. No uses paralelismo para multiplicar instalaciones, compilaciones y bases de datos innecesariamente.

Un único escritor por archivo compartido. Coordina especialmente rutas, contratos API, migraciones, lockfiles, pruebas/configuraciones y generadores. El archivo que necesita otro especialista se transfiere explícitamente; no se usa su propiedad como excusa para dejar una conexión incompleta.

Usa sesiones/tareas reales y registra IDs devueltos. No inventes flags de concurrencia ni supongas que crear perfiles significa que se ejecutaron. Conserva el DeepSeek 4.1 Flash seleccionado; verifica overrides de modelo sin inventar IDs. Un subagente no cambia por sí mismo de carpeta ni aísla la base. Aísla los recursos que mutan datos.

El revisor debe poder leer código/evidencia y comprobar el resultado con herramientas disponibles. No lo dejes con permisos que le impidan inspeccionar justamente lo que debe evaluar. No puede modificar el código de producto que está aprobando.

## 5. Nueva identidad visual: construir de nuevo, no cambiar el tema

Diseña a partir de las tareas, no de la estructura del frontend anterior. El nuevo aspecto no tiene que conservar el verde, la barra lateral de iconos, los títulos repetidos, las tarjetas ni los contenedores actuales. Crea nombres y componentes nuevos cuando ayuden a separar responsabilidades, no para encubrir el mismo markup.

Define una identidad propia con paleta, tipografía local, escala, espaciado, superficies, controles y lenguaje de interacción consistentes. Mantén el nombre y los logos oficiales auténticos disponibles; identidad visual nueva no significa inventar un escudo del hospital ni modificar sus datos legales.

Elige una dirección clara y úsala en todas las superficies. La aplicación debe tener buena composición y carácter visual, pero seguir siendo una herramienta cotidiana. Evita dashboards de tarjetas gigantes, encabezados de marketing, etiquetas técnicas permanentes y bloques de carga que ocupen media pantalla. No reduzcas letra o zoom para aparentar eficiencia.

Desarrolla temprano Cobrar, un Resumen breve y el comprobante con el diseño nuevo. El diseñador y el revisor deben evaluar composición, jerarquía, navegación y recorrido, no solamente alturas. Si siguen siendo la distribución anterior con otro color, cambia la propuesta antes de propagarla. Presenta la evidencia temprana sin detener todos los frentes esperando aprobación de un botón.

La UI final es código interactivo, no una imagen ni un prototipo sin conexión. Las referencias visuales externas son inspiración de diseño, nunca autoridad sobre campos clínicos/fiscales. Las pantallas rechazadas sirven como evidencia de lo que debe cambiar, no como diseño que debas imitar.

## 6. Secciones nuevas: contenido y tarea definidos

La navegación principal, filtrada por permisos, tendrá **Resumen, Cobrar, Recibos, Caja y Reportes**. Administración será secundaria. El cajero entra directamente a Cobrar; quien supervisa puede entrar a Resumen. No dupliques Historial y Recibos como dos productos distintos.

| Sección | Contenido obligatorio | Simplificación |
|---|---|---|
| **Resumen** | Actividad del ámbito autorizado: emitido/facturado, cobrado, saldo con fecha de corte y operaciones sin cobro; caja actual y operaciones recientes. | Un resumen compacto, no réplica de todos los informes ni pantalla obligatoria antes de cobrar. |
| **Cobrar** | Nombre del paciente, búsqueda de catálogo, cantidades, regla aplicable, valoración, método/importe entregado cuando proceda, confirmación y resultado. | Un recorrido continuo; no registro previo de pacientes ni cadena de tres confirmaciones equivalentes. |
| **Recibos** | Historial por paciente/número/fecha/estado, operación y documento vinculados, detalle, PDF, reimpresión y recuperación del comprobante. | Una búsqueda y una tabla principal; muestra el tipo real de documento sin obligar a entender tablas internas. |
| **Caja** | Apertura, movimientos, importes por método, efectivo esperado, contado/diferencia, cierre y resumen imprimible/exportable. | Una caja por defecto; selección adicional solo cuando hay varias habilitadas. |
| **Reportes** | Período, filtros autorizados, resumen numérico, detalle de operaciones, servicios/productos, cobros, caja/cajero, gratuidades y exportaciones. | Una tabla por propósito; desglose bajo demanda, no dos tablas iguales ni gráficos vacíos de adorno. |
| **Administración** | Catálogo/precios, usuarios/permisos, identidad institucional, papel/copias y mantenimiento mínimo. | Sin constructor de plantillas, editor complejo de workflows ni paneles técnicos para el cajero. |

Retira las pantallas extensas de Ayuda/Soporte/Acerca de como destinos principales. Sustitúyelas por ayuda breve contextual y un acceso técnico secundario. Retira Respaldos del menú cotidiano, pero mantén su servicio, automatización, alertas y recuperación protegida dentro de mantenimiento.

Mapea TODAS las rutas antiguas a un destino nuevo o a una retirada explícita. Conserva enlaces históricos útiles mediante redirecciones autorizadas, no mediante un segundo shell antiguo. No ocultes acciones necesarias para dar una apariencia de sencillez.

## 7. Datos del paciente: SOLO el nombre

El único dato del paciente requerido para emitir la operación es **Nombre del paciente**. No añadas identidad, RTN del paciente, teléfono, email, domicilio, edad, diagnóstico, expediente, seguro o una ficha de admisión. Tampoco exijas crear/seleccionar un paciente en un CRM antes de cobrar.

Guarda el nombre tal como corresponde a esa operación, con validación y normalización de espacios razonable. Acepta tildes, apóstrofos y nombres largos. Dos personas con el mismo nombre no se fusionan automáticamente y el nombre no es una clave única.

El resto de los datos operativos —fecha, cajero, caja, número, estado— lo obtiene el sistema. La condición de diálisis se registra cuando aplica a la regla del medicamento; no crea un expediente clínico ni se hereda permanentemente de otra operación del mismo nombre.

## 8. Regla de negocio crítica: gratuidad EXCLUSIVA del medicamento elegible

El antecedente del proyecto identifica el medicamento como **Eritropoyetina (EPO)** y el código `ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION`. Localiza el registro y la regla reales antes de enlazarlos. No dependas de un número de ID arbitrario ni de que el nombre contenga una palabra. El precio histórico de L 25.00 es antecedente, no una instrucción para sobreescribir el catálogo vigente.

Regla expresa del usuario:

> Cuando la condición autorizada de receta/diálisis corresponda al medicamento elegible, ese medicamento puede quedar sin cobro. Los demás productos y servicios de la misma operación mantienen su precio y tratamiento aplicable.

La condición puede recogerse una vez en la operación, pero el efecto se evalúa **por cada línea**: identidad elegible + condición válida + permiso. Un booleano en la raíz NO significa descuento del 100 % sobre toda la factura.

No conviertas automáticamente en gratuitos todos los medicamentos, todos los ítems ni el propio servicio de diálisis. Si diálisis figura como concepto cobrable separado, conserva su precio salvo una regla institucional específica comprobada. No inventes dosis, topes, equivalencias uno-a-uno ni requisitos clínicos. Tampoco exijas añadir artificialmente un servicio llamado Diálisis solo para activar una condición que en el dominio se acredita con la receta.

En la interfaz, la opción de la regla aparece cuando hay medicamento elegible y el operador tiene permiso. El servidor valida de nuevo ambas condiciones y devuelve las líneas ajustadas, su causa y el importe final. El texto explica que solo afecta al medicamento, no “Factura gratis”.

**Ejemplos de aceptación; importes sintéticos, sin impuestos para aislar esta regla:**

| Caso | Resultado esperado |
|---|---|
| EPO L 25, sin condición válida | EPO L 25; total L 25. |
| EPO L 25, con condición autorizada | EPO L 0; total L 0; emisión sin cobro. |
| EPO L 25 + diez productos de L 100 cada uno, con condición autorizada | EPO L 0; cada otro producto L 100; total L 1,000. |
| Mismo carrito sin condición válida | Total L 1,025. |
| Condición activa, pero ningún producto elegible | Ningún producto se vuelve gratuito. |
| Otro medicamento de L 25 con nombre similar | Mantiene su precio; igualdad de precio/nombre no concede la regla. |
| EPO + concepto de diálisis cobrable + otros productos | Solo EPO se ajusta, salvo otra regla concreta demostrada para diálisis. |
| Usuario sin permiso manipula flags o precios | Rechazo en servidor; no se emite ni cobra una operación manipulada. |

Prueba cantidades múltiples y líneas duplicadas sin extender el beneficio a otros productos ni inventar límites. Si el modelo admite unidades parcialmente elegibles, conserva su alcance explícito; nunca amplíes silenciosamente una gratuidad parcial a la línea completa.

Los documentos muestran los productos entregados y el importe final de cada línea. Una línea gratuita sigue apareciendo; no se borra del detalle para obtener el total.

**Gratuidad no es exención de impuestos.** Un producto exento puede tener precio positivo. No utilices `tax_exempt` como sustituto de esta regla. Los impuestos de las otras líneas se calculan normalmente según la política real, no conforme a la tasa de un fixture antiguo.

Una operación completamente gratuita no crea un cobro ficticio ni aumenta efectivo o conteo de cobros reales. Si el histórico contiene asientos técnicos de cero, preserva su trazabilidad y sepáralos en consultas/reportes. El nuevo contrato debe representar emisión sin cobro sin fingir un ingreso en método Otro.

## 9. Reconstrucción de la facturación y el pago

Separa explícitamente borrador, valoración, confirmación, emisión, pago, resultado y recuperación. No representes combinaciones imposibles con una colección de booleanos independientes.

El backend es autoridad sobre precios, cantidades, regla de diálisis, impuestos y totales. Usa una valoración que no emita números ni registre pagos para alimentar la revisión. No mantengas un cálculo del navegador incompatible con el servidor.

Un mismo resultado canónico alimenta cuenta, confirmación y acción de cobro. Antes de escribir, fija las invariantes y las respuestas esperadas del nuevo contrato; no adaptes el dominio a una prueba vieja equivocada. Si cambia paciente, carrito, condición, precio o regla relevante, invalida la valoración y no permitas confirmar una versión vieja. Gestiona respuestas tardías y doble activación. Un error o un dato ausente nunca se muestra como L 0.00.

Distingue en UI: listo para cobrar un importe positivo; emisión válida sin cobro; calculando; inválido; servidor no disponible; emitido pendiente de cobrar; pagado con comprobante pendiente. Mantén una acción deliberada de confirmación y posibilidad de corregir antes de ejecutarla.

Enter en un campo no debe cobrar accidentalmente. Los botones enfocados conservan su activación normal con teclado. No impongas un atajo poco visible como única forma de confirmar.

Usa una identidad de operación y protección idempotente comprobada en servidor. Un retry, doble clic, refresh o dos clientes no crean cobros o correlativos duplicados. Ante timeout después del commit, recupera el resultado previo antes de proponer otra operación.

Puedes reorganizar endpoints o crear una orquestación de aplicación coherente. Si emisión y pago conservan transacciones separadas, representa los fallos intermedios y la reanudación sin duplicar documentos. Una interfaz sencilla no obliga a mentir que todo fue atómico.

El resultado permite Imprimir/Guardar PDF y Nueva operación. Un fallo del PDF o de la impresora no vuelve a cobrar. El siguiente paciente no hereda el nombre, la condición de diálisis ni los datos del anterior.

## 10. Backend y datos: nueva organización, contratos completos

Reconstruye los módulos de catálogo/precios, valoración/reglas por línea, emisión/correlativos, pagos/caja, comprobantes y consultas/reportes. Consolida validaciones, respuestas, errores y autorización. La lógica de negocio no vive en plantillas PDF ni componentes React.

Puedes reescribir los servicios, controladores, modelos, contratos HTTP y esquema necesarios; no te limites a parches de frontend. La conservación obligatoria es de las garantías y datos, no de una implementación concreta.

Mantén dinero exacto mediante centavos/Decimal adecuado y cantidades con escala explícita. Separa conversión de intercambio de formato visual. Ningún resultado formateado como `1,029.25` vuelve a entrar al cálculo. Los errores de parseo no son cero. Evita helpers con el mismo nombre y contratos distintos.

Prueba transacciones, unicidad, locks, alcance de caja, timestamps de emisión y reintentos. Reconstruir no puede reintroducir las fechas que cambiaban al registrar pagos o una restricción global que mezcle cajas independientes.

Cada operación conserva snapshots de paciente, conceptos, tarifas y reglas aplicadas; cambiar el catálogo no recalcula facturas pasadas. La autorización se valida en el servidor para lectura, cobro, anulación, reverso, reimpresión, reportes y configuración. Anulaciones y reversos conservan el documento y la trazabilidad, requieren permiso y motivo, y no reciclan números ni alteran saldos sin movimientos consistentes. No implementes seguridad únicamente con botones ocultos.

Para instalar desde cero puedes definir un esquema limpio coherente. Para datos existentes, prepara y prueba una migración/importación que conserve registros, montos, relaciones, autoría y numeración. No edites migraciones ya aplicadas como si eso actualizara instalaciones existentes. Retira tablas o columnas activas obsoletas solo tras migrar sus consumidores y datos pertinentes.

Preserva claves necesarias para datos cifrados. No copies secretos al repositorio ni a artefactos. Las pruebas que escriban usan destinos sintéticos identificados; localhost o un worktree no prueban aislamiento de datos.

## 11. Comprobante nuevo: breve, legible y sin multiplicación de páginas

Diseña una plantilla nueva, no adaptes superficialmente la vieja. La composición, identidad tipográfica y distribución las decide el equipo dentro de los requisitos funcionales. No construyas un editor visual de facturas.

Para nuevas operaciones, usa **carta vertical, 215.9 × 279.4 mm, 612 × 792 puntos**, con A4 como alternativa administrativa. Un ejemplar para el paciente es el valor predeterminado de esta entrega. Copias adicionales son una selección explícita, no tres documentos concatenados obligatoriamente.

Para 1, 2, 5, 10 y 11 conceptos ordinarios con descripciones normales, diseña y prueba **una página por ejemplar** manteniendo detalle legible. Los casos realmente extensos pueden continuar; no ocultes filas, fuerces `pages=1` ni reduzcas toda la letra para cumplir una cifra. Comienza alrededor de 10–11 puntos en el detalle y 10–12 mm de margen, ajustando con pruebas reales del motor.

Contenido: identidad institucional real, tipo y número del documento, fecha/hora, **nombre del paciente**, cajero/caja pertinentes, descripción, cantidad, precio unitario, ajuste por regla si corresponde, importe de línea, totales, situación del pago, método aplicable y firma/sello cuando procedan. Las líneas gratuitas deben ser reconocibles sin alterar las demás.

Factura, pago y recibo pueden tener identidades distintas en los datos. Unifica el recorrido del usuario sin borrar esa distinción contable ni imprimirle dos expedientes duplicados. El rótulo fiscal/institucional debe corresponder a lo que realmente se emite.

No inventes RTN, CAI, tasas, teléfonos, sellos o firmas; no presentes los valores de validación antiguos como datos oficiales. Reorganiza campos obligatorios comprobados de forma compacta. No añadas datos personales que el usuario no pidió.

El reporte de una factura de unas doce páginas es un síntoma a reproducir, no un hecho ya comprobado aquí. Distingue páginas de contenido, copias concatenadas, hojas en blanco y multiplicador del diálogo. Corrige el origen en el generador/flujo.

Usa el motor real y CSS compatible con su versión. Si es Dompdf, comprueba sus limitaciones de flex/grid y de filas de tabla que no pueden partirse: no encierres todo el comprobante en una fila indivisible ni traslades el layout del navegador sin probarlo. Usa una instancia limpia por documento. Comprueba saltos, altura, fuentes y márgenes. La vista de navegador no demuestra que Dompdf lo dibuje igual. La impresión incluye solo el documento, nunca menús, reportes o toda la aplicación.

Preserva el contenido financiero de los históricos. La nueva plantilla gobierna nuevas emisiones. Si se habilita regeneración visual de un histórico, debe quedar identificada como presentación regenerada, con datos originales intactos y versión/trazabilidad; no sobreescribas silenciosamente el archivo original.

## 12. Recibos, impresión y configuración efectiva

En Recibos, busca por paciente, número, fecha, estado y caja autorizada. Abre el detalle conectado a la operación y sus pagos; ofrece recuperación del documento ya emitido y reimpresión autorizada. La primera impresión y la reimpresión no deben generar nuevos cobros ni números.

Registra solicitud de impresión/descarga/reimpresión con semántica clara. Mantén motivo y contador durable de reimpresión donde corresponde; no uses frases automáticas para fingir que el operador proporcionó un motivo. No derives el contador de logs sujetos a poda.

Configuración mínima: carta/A4, número explícito de ejemplares y datos institucionales autorizados. Distingue el perfil de entrega nuevo de asignaciones heredadas; haz que guardar, recargar y emitir una operación nueva use el resultado esperado. No pruebes solo el valor inicial de un seeder.

La vista previa utiliza el borrador actual sin persistirlo ni consumir correlativo. Conserva proporción, zoom legible y navegación de páginas, sin tres miniaturas ilegibles dentro de scrolls anidados. Rechaza valores inválidos en lugar de dejar un select vacío.

Antes de imprimir, informa páginas y ejemplares. Evita multiplicar copias tanto en el PDF como en el diálogo. No afirmes que abrir/cerrar el diálogo demuestra salida de papel. Maneja cancelación, popup bloqueado y descarga alternativa sin pérdida del pago.

## 13. Resumen y Caja: datos simples con significado exacto

Resumen responde: cuánto se emitió, cuánto se cobró, qué saldo existe al corte, cuántas operaciones fueron sin cobro y cuál es la caja/turno del usuario. Indica ámbito y período; no mezcles métricas del día y del mes bajo un solo rótulo.

No asumas que `facturado del período - cobrado del período = saldo pendiente`: puede haber cobros de facturas anteriores. Define la cohorte de facturas y los movimientos por fecha de pago por separado. Para una cohorte consistente, demuestra su conciliación con saldo al corte, ajustes y reversos aplicables.

Caja distingue caja física, usuario y sesión. Apertura, movimientos, efectivo esperado, contado/diferencia y cierre deben funcionar para una caja o varias simultáneas. Un operador no trabaja sobre una caja ajena por cambiar un ID en el navegador.

Efectivo esperado se obtiene de apertura y movimientos efectivos de efectivo, con entradas/salidas y reversos válidos; transferencias, tarjetas y operaciones gratuitas no se suman como billetes. Cierra con confirmación, permisos y motivo cuando exista diferencia. El resumen de cierre puede exportarse/ imprimirse sin convertirse en el recibo del paciente.

Los fallos de conexión y de configuración se muestran junto a la tarea afectada. No anuncies “listo para cobrar” si aún falta validar una condición imprescindible; tampoco tapes toda la aplicación por un dato no crítico de mantenimiento.

## 14. Reportes completos en pantalla, Excel y PDF

Reconstruye consultas, DTOs, vista y exportadores con una fuente de datos coherente. Misma moneda, filtros, ámbito autorizado, fecha de corte y reglas de inclusión. Una exportación no debe reflejar otra página de datos, un filtro antiguo o el estado mutable del frontend.

Filtros: hoy, rango personalizado y opciones frecuentes simples; cajero/caja/categoría cuando tenga sentido y permiso. Separa fecha de emisión, fecha de cobro y saldo al corte. Registra el instante/dataset usado cuando sea necesario para comparar formatos con operaciones simultáneas.

Datos obligatorios, sin tablas duplicadas:

- Resumen: emitido/facturado, cobrado, saldo con ámbito definido, anulaciones/reversos, cantidad de operaciones y operaciones sin cobro.
- Operaciones: fecha, número, nombre del paciente, caja/sesión, cajero, total, pagado, saldo, estado y documento relacionado.
- Detalle: operación, producto/servicio, cantidad, precio registrado, ajuste por regla, base/impuestos aplicables e importe final.
- Cobros: fecha real de pago, operación, paciente, caja/sesión, cajero, método, referencia autorizada, importe y estado.
- Caja: apertura/cierre, responsable, montos por método, esperado/contado/diferencia y motivo pertinente.
- Gratuidades: medicamento/servicio, cantidad entregada gratuitamente, valor del ajuste y motivo; no confundir unidades entregadas con unidades cobradas.

**Excel `.xlsx`:** usa hojas `Resumen`, `Operaciones`, `Detalle`, `Cobros` y `Caja`, con la gratuidad identificada en Resumen/Detalle. Solo incorpora otra hoja si resuelve información necesaria que no cabe razonablemente allí. No generes diez hojas de relleno.

El nombre del paciente debe viajar en Operaciones, Detalle y Cobros cuando exista esa relación, sin recaptura ni cruces por nombre. Usa valores numéricos para importes/cantidades, conteos enteros, porcentajes como porcentaje y fechas utilizables con su criterio temporal documentado. Encabezados, cuerpo y totales tienen rangos y estilos distintos. Ajusta anchos, filtros, paneles inmovilizados y área de impresión cuando corresponda.

No exportes IDs técnicos como único nombre de caja/sesión, ni `open/closed` como texto final para el usuario. Conserva identificadores útiles en columnas claras. Neutraliza contenido de texto que pudiera ejecutarse como fórmula; no conviertas nombres en fórmulas. Escribe números de factura/recibo como texto cuando deban conservar ceros iniciales. Con PhpSpreadsheet, utiliza tipos explícitos donde la inferencia pueda alterar identificadores o interpretar texto como fórmula. No trates el formato visual como sustituto del tipo numérico.

Prueba porcentajes 0, 0.5 y 1, conteos 0/1/muchos, importes mayores de mil, tildes, nombres largos, tabla vacía/una fila/muchas filas y varias cajas. Inspecciona valores, tipos y formatos del archivo real, no solo que el endpoint devuelve 200.

**PDF de reportes:** primera página con resumen legible y detalle solicitado después, no la UI impresa literalmente. Cabeceras de tabla repetidas en continuaciones, títulos unidos a sus primeras filas, importes alineados, fechas y estados legibles, identificación de período/filtros y páginas. No obligues a un informe extenso a caber en una página; esa expectativa es para el comprobante corto del paciente.

Resumen de caja y recibo del paciente son salidas distintas del reporte ejecutivo. Todas comparten datos correctos, no necesariamente la misma plantilla. Comprueba sumas y significado en UI, XLSX y PDF, incluidos carrito mixto con EPO y documentos anulados.

## 15. Administración, seguridad y operación local

Catálogo simple de productos/servicios, precio, categoría/área pertinente, disponibilidad y regla específica. Los cambios no alteran históricos. No fuerces al cajero a configurar impuestos o series en cada operación.

Usuarios individuales con roles/permisos coherentes y comprobación en servidor. Reset de clave administrado localmente; sin registro público ni dependencia obligatoria de correo externo. No añadas OAuth o MFA como ampliación de alcance no solicitada.

Arranque inicial corto: identidad del hospital, administrador seguro, una caja, papel/ejemplar y destino de respaldo. No un tour largo. No incluyas datos ficticios fiscales como valores listos para producción.

Backups automáticos y restauración verificada se conservan, pero su UI queda en mantenimiento administrativo. No borres esa capacidad para simplificar menús. Un estado desconocido o sin backup no es “todo correcto”. Los avisos importantes funcionan sin Internet.

El sistema debe operar con servidor local y recursos locales —fuentes, assets, librerías, PDFs— y admitir clientes LAN por navegador. Si cae Internet y el servidor sigue disponible, el flujo central sigue funcionando. Si cae el servidor, no confirmes cobros ficticios ni implementes sincronización financiera improvisada en LocalStorage.

Prepara una única ruta sencilla de instalación/actualización y arranque. Las herramientas de desarrollo no se instalan en la PC del cajero para compilar el producto. Empaqueta dependencias de ejecución autorizadas y prueba prerrequisitos, permisos, reinicios y reanudación. No prometas que un runtime no necesita preparación: haz que la gestione el instalador donde sea viable.

Puedes reconstruir scripts y servicios de instalación necesarios; elige una solución mantenible, no varias rutas incompletas. Revisa licencias antes de redistribuir runtime. Docker/WSL tiene antecedentes de avería: diagnostica antes de actuar y no destruyas distribuciones, volúmenes, imágenes ajenas ni discos para resolverlo.

Protege transporte, sesiones, secretos y puertos LAN sin desactivar globalmente validaciones, firewall o CORS. Prueba restauración en un destino sintético y conserva las claves. Distingue validación de laboratorio y comprobación pendiente en el equipo, segunda PC e impresora reales.

## 16. Accesibilidad y revisión visual integrada

Construye con controles semánticos, labels, foco visible, lectura y navegación con teclado, mensajes de error útiles, contraste, zoom y movimiento reducido. Una etiqueta técnica de accesibilidad no convierte un control invisible o un diálogo cortado en algo usable.

Comprueba pantallas llenas y vacías, cargas/errores, carrito mixto, nombres largos, diálogos con muchas líneas y ventanas pequeñas. No escondas columnas necesarias ni reduzcas el zoom del navegador para “aprobar”. Verifica desktop habitual, móvil/tablet pertinentes y zoom real hasta 200 %.

Cada autor visual carga las dos skills; diseñador y revisor evalúan el render, no solo clases CSS. Compara captura de referencia nueva y pantalla implementada con mismo estado/viewport. El objetivo es fidelidad a la identidad nueva y facilidad de uso, no conservar el número de píxeles de R2.

Verifica que las herramientas y el modelo utilizados permiten inspeccionar imágenes. Producir PNGs no es verlos. Si no hay inspección de píxeles disponible, no declares aprobación visual ni cambies de proveedor sin permiso; entrega evidencia y declara exactamente la revisión que falta. Sigue implementando y probando lo verificable.

No otorgues aprobación global por 40 mediciones geométricas, por axe sin hallazgos ni por cantidad de tests. Separa composición visual, funcionalidad, accesibilidad y salida impresa.

## 17. Pruebas que deben proteger esta reconstrucción

Escribe regresiones sensibles al error antes de corregirlo cuando exista un defecto reproducible. Los tests obsoletos de layout/rutas se sustituyen por los del producto nuevo conservando cobertura funcional. No debes mantener una pantalla rechazada solo para satisfacer un test antiguo.

La integración central se comprueba con backend y base de laboratorio reales: autenticación, catálogo, nombre único obligatorio, regla EPO por línea, cobro normal, cero autorizado, carrito mixto de once líneas, receipt recovery, historial, caja, reportes y exportaciones.

Comprueba cantidades, límites, mil lempiras, datos inválidos, respuestas antiguas, manipulación de permisos/precios, doble clic, retry tras commit, sesiones/cajas simultáneas, apertura/cierre y medianoche. Usa conexiones/procesos independientes para concurrencia; buscar la palabra lock en código no es una prueba de carrera.

Con TanStack Query, aísla caché/clientes de pruebas y valida invalidación de precios/permisos entre usuarios. Los fixtures de EPO incluyen la identidad y regla correctas y prueban importes persistidos, no solo que un regex encuentra “confirmar”.

Vitest y Playwright deben descubrir sus suites propias sin ocultar pruebas de ninguno. Conserva los defaults de exclusión al añadir rutas especiales y comprueba el comando que ejecuta las E2E excluidas de Vitest. El OOM requiere ajuste de ejecución por proyectos/concurrencia, no borrar tests o repetir el mismo fallo hasta agotar recursos.

Mide typecheck, lint, build, backend, unitarias, integración, E2E y pruebas visuales/artefactos aplicables. Si retiras Storybook u otro subsistema de desarrollo por simplificación, retira coherentemente dependencias, configuración y scripts y traslada las pruebas útiles; no lo declares aprobado cuando no se ejecutó.

Para MariaDB verifica motor/versión efectivos dentro de la conexión de pruebas. El binario nativo de laboratorio y la imagen final de despliegue son entornos diferentes y se reportan como tales. No pierdas la cobertura de timestamps, índices, triggers y locks por usar únicamente SQLite.

## 18. Retirada efectiva y continuidad sin burocracia

Completa cada sustitución: nuevo componente/servicio → consumidores migrados → rutas conectadas → pruebas → eliminación de la implementación activa anterior. Incluye CSS, helpers, plantillas, endpoints sin consumidores y flags de transición caducos. No dejes indefinidamente versión vieja y nueva detrás de un toggle.

Preserva un archivo histórico recuperable fuera del build. No borres código de otro proyecto, secretos ni evidencia personal. Una abstracción no usada no se conserva por imaginar un SaaS futuro.

Mantén solo documentos vivos útiles: `MANDATO_DEV.md` (este encargo), `MAPA_PRODUCTO.md` (secciones/contratos/destinos) y `ESTADO_DEV.md` (tareas, dueños, decisiones, pruebas y siguiente paso), o equivalentes ya canónicos sin duplicarlos. La evidencia por tarea puede vivir en carpetas referenciadas; no hace falta narrar cada lectura.

Dev toma decisiones ordinarias de implementación y diseño sin consultas repetitivas. Detiene únicamente la acción afectada por credenciales ausentes, gasto, datos reales, permisos superiores, reglas institucionales auténticamente desconocidas o hardware indispensable. Continúa los frentes independientes.

No hace falta autorización adicional para reconstruir la UI, backend, formularios o exportaciones descritos. Sí hace falta para ejecutar destrucción de datos reales o aceptar gastos/licencias. Los comandos críticos del entorno no se habilitan globalmente por este mandato.

Ante límite real de contexto/herramientas, guarda estado reanudable y evidencia; no finjas trabajo fuera de la sesión. No reabras toda la auditoría al continuar.

## 19. Secuencia de ejecución y entrega

Secuencia: proteger fuentes y mapear contratos → instalar/cargar ambas skills → definir identidad y base común → construir Cobrar/Resumen/comprobante nuevos → implementar las demás familias en paralelo con el backend → integrar y retirar código anterior → revisar y reparar → validar entrega.

No esperes a completar otra auditoría o todos los tests de infraestructura para comenzar el diseño nuevo. Tampoco publiques o habilites operaciones reales con un contrato financiero roto. El laboratorio y los datos sintéticos permiten avanzar en paralelo.

El revisor independiente puede rechazar el producto por errores funcionales, un diseño que siga siendo el anterior, formularios desconectados, documentos ilegibles o evidencia falsa. Dev resuelve e integra sus observaciones; el revisor no aprueba su propio diff.

Entrega:

1. La aplicación nueva integrada: Resumen, Cobrar, Recibos, Caja, Reportes y Administración simplificada.
2. Evidencia de instalación y carga de ambas skills, más ejemplos concretos de aplicación al resultado.
3. Capturas realmente inspeccionadas de cada superficie y flujo, con antes/después pertinentes; no cientos de imágenes sin revisar.
4. Comprobante real corto de un ejemplar y pruebas de contenido/paginación, otro de cero válido y otro de carrito mixto.
5. PDF y XLSX reales del mismo conjunto de datos, con el nombre del paciente y los campos definidos.
6. Lista de implementaciones retiradas, módulos reescritos, cambios de contratos y migraciones probadas.
7. Comandos y resultados actuales, cobertura no ejecutada y revisión independiente.
8. Paquete/manifiesto reconstruible de las fuentes y artefactos necesarios, sin credenciales ni datos reales, e instrucciones de instalación/arranque que correspondan al paquete.

Distingue IMPLEMENTACIÓN, VALIDACIÓN TÉCNICA, REVISIÓN VISUAL y VALIDACIÓN EN EL HOSPITAL. No cierres implementación con trabajo local conocido sin terminar ni fabriques aprobación del dueño, del instalador, de una segunda PC o de la impresora.

**Empieza ahora. Instala y carga las dos skills, crea la nueva identidad visual, distribuye implementación entre varios agentes y reconstruye el producto completo. No hagas la misma UI más pequeña. No vuelvas a preguntar si haces el punto 1 o el 2.**

---

## Referencias verificadas para redactar este encargo

Consulta: 18 de septiembre de 2026. Las guías de OpenAI/Anthropic se usan como principios de trabajo; sus parámetros, modelos y herramientas específicas no se transfieren por analogía a DeepSeek/OpenCode.

- Better UI: https://www.skills.sh/jakubkrehel/skills/better-ui
- Emil Design Engineering: https://www.skills.sh/emilkowalski/skills/emil-design-eng
- Skills CLI, opciones e instalación por proyecto: https://github.com/vercel-labs/skills
- OpenCode, carga y permisos de skills: https://opencode.ai/docs/skills/
- OpenCode, agentes nativos: https://opencode.ai/docs/agents/
- OpenAI, diseño de interfaces: https://developers.openai.com/blog/designing-delightful-frontends-with-gpt-5-4
- OpenAI, tareas prolongadas: https://developers.openai.com/blog/run-long-horizon-tasks-with-codex
- Anthropic, instrucciones claras y ejemplos: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
- Anthropic, generación y evaluación separadas: https://www.anthropic.com/engineering/harness-design-long-running-apps

- npm/npx, posición de argumentos y confirmaciones: https://docs.npmjs.com/cli/v11/commands/npx/
- React, estructura del estado: https://react.dev/learn/choosing-the-state-structure
- Dompdf, capacidades y límites por versión: https://github.com/dompdf/dompdf
- PhpSpreadsheet, valores/tipos: https://phpspreadsheet.readthedocs.io/en/latest/topics/accessing-cells/
- PhpSpreadsheet, formatos: https://phpspreadsheet.readthedocs.io/en/latest/topics/Behind%20the%20Mask/
- TanStack Query, aislamiento de pruebas: https://tanstack.com/query/latest/docs/framework/react/guides/testing
- Vitest, exclusiones: https://vitest.dev/config/exclude
- W3C, prevención de errores financieros: https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html
- MDN, impresión del navegador: https://developer.mozilla.org/en-US/docs/Web/API/Window/print
