# MANDATO DEFINITIVO — S_HOSPITAL

## Actualización técnica, rediseño global, operación offline/LAN y entrega verificable

**Estado:** VIGENTE desde 2026-09-17. Reemplaza a `hospital-ai/PROMPT_MAESTRO.md`
(conservado como histórico). Normalización fiel del mandato entregado por el
usuario en la sesión del 2026-09-17.

### 0. Misión y alcance

Trabaja como `hs-orchestrator` dentro de OpenCode, usando el DeepSeek 4.1 Flash
que el usuario ya tiene seleccionado y su proveedor actual. Misión: actualizar el
conocimiento del repositorio, completar la implementación, rediseñar globalmente
la experiencia, integrar todos los módulos y demostrar su funcionamiento.

El producto es S_Hospital, sistema de caja del Hospital General San Isidro. NO es
Dovra AI, un CRM SaaS ni un sistema clínico nuevo. Los ejemplos del CRM aportan
exigencia de diseño y revisión adversarial, no sus módulos, roles, métricas,
suscripciones ni arquitectura multiempresa.

Este mandato reemplaza el encargo anterior de auditoría exclusivamente read-only.
La inspección inicial es una fase de trabajo, no la entrega final. Autoriza
sustituir directrices visuales anteriores y rediseñar los comprobantes. NO
autoriza eliminar trazabilidad, inventar requisitos fiscales, modificar reglas
clínicas o destruir información.

Trabaja sobre lo que existe ahora: hay mejoras posteriores a la auditoría
histórica. No repitas correcciones ya integradas ni reconstruyas un sistema
funcional por preferencia personal. Meta: producto hermoso, ágil, consistente,
accesible, recuperable e instalable; no un informe persuasivo ni una demo.

### 1. Entorno, autonomía y límites

- Identifica workspace real, HEAD, rama, worktrees, staged/unstaged/untracked y
  procesos activos. Rutas históricas `C:\Projects\S_Hospital` y
  `C:\Projects\S_Hospital_AI`; comprueba dónde está el trabajo más reciente.
  No recrees el worktree ni sobreescribas cambios de otros agentes.
- Puedes modificar código y configuración de desarrollo, instalar dependencias
  justificadas, crear fixtures sintéticos, ejecutar pruebas, compilar y
  refactorizar. Conserva el stack útil y el gestor de paquetes canónico.
- Migraciones nuevas preservan datos y se prueban sobre bases desechables antes
  de proponerse para instalaciones existentes.
- NO: push, publicación, compras, cambios en producción, operaciones destructivas
  sobre datos reales, exposición de credenciales, aceptación de contratos por el
  usuario, reset/clean, descartar trabajo ajeno.
- Una dirección localhost no prueba que una base sea desechable. Antes de pruebas
  que escriban, verifica instancia, nombre, credenciales limitadas, marcador de
  entorno y aislamiento de volúmenes. No reutilices credenciales del hospital.
  Redacta secretos y datos personales en reportes y capturas.
- Resuelve decisiones técnicas y visuales ordinarias sin consultas repetitivas.
  Una dependencia externa bloquea su comprobación concreta, no todos los módulos.
  La impresora física pendiente no es excusa para dejar sin implementar su
  interfaz o sus pruebas locales.

### 2. Repara primero la coordinación y los permisos de QA

Lee los `AGENTS.md` aplicables, configuración efectiva de OpenCode,
`.opencode/agents/`, comandos, skills y documentos de `hospital-ai/`. No asumas
que coinciden con el paquete original.

El ZIP v2 original incluía prohibiciones generales para Playwright, Puppeteer y
`test:e2e`. Comprueba si siguen presentes: contradicen la autorización actual para
QA local con datos sintéticos.

Tienes autorización para ajustar únicamente las instrucciones y permisos de
proyecto que correspondan, conservando copia previa y diff. Habilita los comandos
y herramientas necesarios para verificar esta aplicación local mediante un
entorno/runner acotado. Mantén las protecciones de producción, secretos, destinos
externos, gasto y operaciones destructivas. No conviertas todos los permisos en
`allow` ni rodees una prohibición de plataforma usando otra herramienta.

Comprueba permisos efectivos con una prueba inocua; editar un archivo no demuestra
que una sesión haya recargado su configuración. Si hace falta reiniciar OpenCode,
conserva el estado y comunica una única acción exacta para reanudar.

Guarda este mandato como documento vigente, preservando el anterior como
histórico. Si existe `/hs-terminar`, actualiza su referencia de forma compatible
para que no vuelva a cargar el encargo obsoleto. No cambies proveedores, API keys
ni configuración global del usuario.

### 3. Auditoría de actualización, no otra auditoría interminable

Construye una línea base actual: versiones exactas desde lockfiles, arquitectura y
servicios efectivos, esquema y migraciones, rutas montadas, permisos, flujos,
impresión, instalación, backups y suites disponibles. Diferencia la configuración
declarada de lo que realmente se ejecuta.

Compara cada hallazgo histórico con el código presente. Clasifica: RESUELTO Y
REVALIDADO, PERSISTE, REGRESIÓN, CAMBIÓ EL DISEÑO o NO VERIFICADO. Cada conclusión
importante necesita ruta, símbolo, revisión y evidencia. No copies cantidades
antiguas de pantallas, tablas o tests.

Revalida especialmente los antecedentes: configuración de recibos inaccesible,
reimpresión inconsistente, CI MariaDB ejecutando SQLite, recuperación Docker-only,
preflight y acceso directo de mantenimiento, guard de backup previo a migraciones,
checksums offline y restricción de una caja global. Son hipótesis históricas, no
defectos actuales confirmados.

Ejecuta primero verificaciones focalizadas seguras. En cuanto existan contratos e
inventario suficientes, comienza los trabajos independientes. La auditoría
continúa junto con la ejecución; no consume toda la campaña.

### 4. Equipo real: coordinador más doce especialistas

Reutiliza y actualiza los agentes existentes. Crea solo los que falten, usando la
sintaxis nativa compatible con la versión instalada. Mantén DeepSeek 4.1 Flash;
verifica la herencia del modelo y cualquier override, sin inventar un identificador
de proveedor.

| Agente        | Responsabilidad principal                                                      |
| ------------- | ------------------------------------------------------------------------------ |
| `hs-ux`       | Dirección visual, sistema de diseño, interacción y criterios de accesibilidad. |
| `hs-frontend` | Implementación global de pantallas, navegación, estados y responsive.          |
| `hs-receipts` | Comprobantes, PDF, perfiles, copias y reimpresión.                             |
| `hs-finance`  | Facturación, pagos, caja, arqueo, idempotencia y concurrencia funcional.        |
| `hs-db`       | Esquema, constraints, migraciones y consistencia monetaria.                    |
| `hs-security` | Autenticación, autorización, privacidad y seguridad LAN.                       |
| `hs-install`  | Instalador offline, arranque, actualización y experiencia de configuración.     |
| `hs-recovery` | Recuperación, mantenimiento, rollback y simulacros.                            |
| `hs-backups`  | Respaldos, custodia de claves, copia externa y alertas.                        |
| `hs-qa`       | Pruebas automáticas, E2E reales, accesibilidad y rendimiento.                  |
| `hs-review`   | Revisión adversarial independiente de implementación y afirmaciones.            |
| `hs-release`  | Integración de entrega, manuales, manifiestos y certificación del artefacto.   |

El coordinador integra, resuelve conflictos y acepta resultados. Cada delegación
incluye objetivo, contexto suficiente, archivos permitidos, dependencias,
restricciones y criterio de aceptación. No repartas todo el repositorio a los doce.

Empieza con hasta seis tareas independientes activas; aumenta hasta doce solo si
las herramientas, recursos y límites del proveedor lo permiten. Limita inicialmente
a dos los trabajos pesados simultáneos. Son decisiones de planificación, no flags
nativos.

Registra IDs reales de sesiones/tareas y archivos producidos. No simules
paralelismo mediante mensajes con doce nombres. Evita delegación recursiva y
agentes esperando en círculo.

Un archivo compartido tiene un propietario activo: rutas, tokens, migraciones,
configuración y contratos no se editan concurrentemente sin coordinación. Las
suites que mutan datos necesitan bases independientes o ejecución serializada. El
revisor no modifica el código que evalúa; puede producir pruebas/evidencia en su
espacio asignado y devolver correcciones al responsable.

### 5. Skills obligatorias y uso comprobable

Localiza y lee `better-ui` de `jakubkrehel/skills` y `emil-design-eng` de
`emilkowalski/skills`, incluidos sus archivos complementarios pertinentes. Registra
ruta y revisión/hash. Instalarlas sin leerlas no cuenta.

Comandos de referencia:

```powershell
npx skills add https://github.com/jakubkrehel/skills --skill better-ui --agent opencode --copy
npx skills add https://github.com/emilkowalski/skills --skill emil-design-eng --agent opencode --copy
npx skills list --agent opencode
```

Inspecciona antes cualquier copia existente; no pierdas modificaciones locales.
Esta preparación ocurre en desarrollo, no como requisito de Internet durante la
operación del hospital.

Prioridad: seguridad y corrección; accesibilidad; requisitos de este mandato;
contratos funcionales; recetas específicas de las skills; criterio visual. Cuando
una receta exacta sea apropiada, conserva su valor, no lo promedies. No apliques
efectos mecánicamente a controles usados continuamente.

`better-ui` no sustituye una revisión completa de distribución, tipografía y
accesibilidad. Ambas skills deben traducirse en evidencia visible y pruebas; no en
una declaración de "polish realizado".

### 6. Arquitectura offline y LAN

Implementa dos modos con el mismo producto: servidor y navegador en una
computadora; o un servidor local con varias computadoras cliente por navegador.
La base de datos es central. No crees copias independientes para sincronizarlas
después ni requieras servicios de nube para funciones centrales.

Sin Internet, con el servidor accesible, deben funcionar login local, catálogo,
facturación, pagos, impresión, historial, caja, reportes, permisos, configuración y
backups. Distribuye localmente los recursos necesarios: frontend compilado, fuentes
autorizadas, iconos, logos, ayudas y dependencias de ejecución.

Sin conexión al servidor, informa el problema y bloquea nuevas confirmaciones
monetarias. No muestres un cobro como exitoso ni generes un correlativo local
provisional. Conserva solo el borrador autorizado y necesario, con protección y
limpieza; al reconectar, consulta el resultado de la operación antes de reintentar
con su identidad idempotente.

Distingue "sin Internet", "servidor no disponible", "sesión vencida" y
"actualización visual retrasada". Un fallo de WebSocket no debe cambiar la verdad
financiera. Prueba estos escenarios desde un navegador nuevo, no únicamente desde
una página ya cargada en caché.

### 7. Usuarios, computadoras y cajas simultáneas

No confundas usuario, terminal, caja física y sesión de caja. Define sus
relaciones, responsables y reglas de apertura/cierre de forma explícita. El modo
inicial debe ser sencillo, con una caja configurada; la administración debe poder
habilitar puestos adicionales sin reescribir el dominio.

El sistema debe admitir varios usuarios y clientes simultáneos. Si la restricción
global histórica impide operar cajas distintas, sustitúyela por restricciones
transaccionales del alcance correcto. No soluciones el problema borrando el lock.

Comprueba propiedad de caja/sesión en servidor, aperturas simultáneas, turnos,
cierre por supervisor, conciliación por caja y total consolidado. No confíes en IDs
de terminal o cajero enviados por el navegador sin autorización. No permitas
compartir una misma sesión de caja de forma accidental entre responsables.

Dos cajas deben poder trabajar sin mezclar dinero ni duplicar números. También
deben estar controladas las carreras sobre una misma factura y el conflicto entre
cobro y cierre. Mantén cuentas individuales; nunca resuelvas la concurrencia
compartiendo la contraseña de administrador.

### 8. Dirección visual global

Diseña una aplicación institucional contemporánea: sobria, clara, hermosa y
suficientemente densa para trabajo continuo. Superficies tranquilas, jerarquía
tipográfica precisa, un acento institucional coherente, números monetarios
alineados y controles evidentes. Respeta los logos oficiales disponibles; no
inventes escudos ni identidad del hospital.

Nada de landing page dentro de la aplicación, grandes mensajes de bienvenida,
gráficos de relleno, gradientes arbitrarios, tarjetas anidadas ni pantallas que
parezcan productos distintos. El diseño debe ayudar a reconocer paciente, servicios,
monto, estado y siguiente acción inmediatamente.

Dirección inicial propuesta: modo claro, superficies blancas, fondo gris frío
suave, texto oscuro y un acento azul petróleo sobrio, ajustado a la identidad
autorizada y al contraste medido. Tipografía local existente o licenciada, cuerpo
de 14–16 px, cifras tabulares, total y paciente con jerarquía superior; no es
obligación descargar fuentes externas. Mantén una familia de iconos y controles
cómodos, no miniaturas.

En el POS, identificación y servicios en el área principal y resumen/cobro en una
columna estable cuando haya espacio; en pantallas estrechas, reorganiza sin ocultar
el total. El historial usa una tabla de trabajo y detalle contextual; caja combina
movimientos, arqueo y diferencia; configuración de impresión une controles y
preview. El encabezado identifica usuario, caja y estado de conexión discretamente.
La navegación prioriza acciones operativas, no métricas decorativas.

Define tokens y componentes compartidos antes de extender el rediseño. Construye
primero tres referencias funcionales conectadas: nueva atención/cobro,
historial/detalle y configuración/preview del comprobante. Revísalas contra los
criterios del mandato y propaga el lenguaje visual a todas las secciones. No te
detengas en esas tres pantallas.

El acabado debe comprobarse en la aplicación renderizada. Identifica defectos
concretos de alineación, densidad, jerarquía, contraste, overflow y estados;
corrige y vuelve a observar. No uses puntuaciones subjetivas "10/10" como prueba.

### 9. Todas las superficies deben quedar conectadas

Inventaría las rutas reales y sus permisos. Revisa y termina acceso/cambio de
contraseña; pantalla operativa; nueva factura/cobro; historial y detalle; caja,
arqueo y cierre; catálogo; reportes; auditoría; usuarios/roles; configuración
institucional/fiscal; recibos e impresión; backups; soporte, mantenimiento y ayuda.

Para cada pantalla exige navegación alcanzable, API real, persistencia,
autorización, estados de carga/vacío/error/éxito y revisión visual. Un componente
probado pero nunca montado en una ruta no está entregado.

Centraliza tablas, filtros, paginación, formularios, diálogos, feedback y búsqueda.
Mantén contexto al volver del detalle, filtros del historial y errores junto a los
campos. Evita perder un formulario por un fallo de red o tapar información crítica
con toasts.

Usa español claro y términos consistentes en pantalla y papel. Prueba búsquedas con
tildes, mayúsculas, espacios, apóstrofos y nombres largos. Mantén montos HNL y zona
operativa America/Tegucigalpa donde corresponda; distingue instante, fecha sin hora
y día operativo, y prueba los límites de medianoche sin depender ciegamente del
reloj o zona del navegador.

Optimiza laptop y escritorio para el cajero; adapta tablet/móvil sin comprimir
tablas hasta volverlas ilegibles. Comprueba escritorio 1366×768 y 1920×1080, tablet
y móvil alrededor de 390 px, además de zoom. No ocultes acciones necesarias para
declarar responsive.

### 10. Accesibilidad e interacción

Usa WCAG 2.2 AA como objetivo verificable, no como certificación automática.
Prioriza HTML semántico, nombres accesibles, labels, navegación con teclado, foco
visible y orden lógico. Menús, diálogos, filtros y tablas deben poder operarse sin
ratón.

Comprueba contraste de texto y controles, información que no dependa solo del
color, zoom, reflow y mensajes de error comprensibles. No retires el outline sin
reemplazo visible. Los elementos fijos no deben ocultar el foco o la acción
principal.

Las operaciones frecuentes deben sentirse inmediatas. Evita movimiento ornamental
en el cobro y acciones de teclado; implementa reduced motion sin eliminar
información. No impongas una animación a cada control por cumplir una receta visual.

Antes de una confirmación financiera, el usuario debe poder comprobar paciente,
conceptos, importe y método y corregir errores. Un Enter desde un campo o una
búsqueda no debe ejecutar accidentalmente un cobro irreversible.

Separa resultados de axe, revisión manual de teclado, contraste/zoom y lector de
pantalla. Lo que no se ejecute queda NOT VERIFIED, aunque las otras comprobaciones
pasen.

### 11. Flujo financiero completo

Verifica apertura de caja → identificación mínima del paciente → búsqueda/selección
de servicios → cantidades → revisión → cobro → comprobante → siguiente operación →
cierre y conciliación.

El servidor determina precios y totales con aritmética monetaria exacta. Conserva
validaciones de reglas especiales, descuentos, exenciones e impuestos existentes
hasta aclarar su autoridad. No cambies una regla de negocio para hacer más bonita o
corta la interfaz.

Cubre importes cero cuando sean válidos, cantidades fraccionarias admitidas,
límites, efectivo/cambio, referencias de transferencia o tarjeta y pagos parciales
únicamente si están habilitados. Registrar una tarjeta no significa integrar ni
verificar un cobro bancario real.

Confirma persistencia antes de mostrar éxito. Ante timeout después del commit,
consulta/reproduce el resultado con la misma identidad idempotente. Si el pago
existe pero falta el comprobante, ofrece recuperación del comprobante: nunca otro
cobro.

Anulaciones, reversos y cierres requieren autorización, motivo cuando corresponda y
trazabilidad. Mantén snapshots históricos y conciliaciones reproducibles. El
comprobante de pago no debe inventar una autorización clínica ni una nueva regla de
admisión de pacientes.

### 12. Nuevo diseño del comprobante

Primero distingue factura fiscal y recibo institucional según el dominio real. No
los renombres ni fusiones solo por estética. Rediseña las salidas necesarias
manteniendo su significado, correlativos y datos obligatorios confirmados.

Para impresora convencional, adopta como diseño principal propuesto carta vertical:
215.9 × 279.4 mm, equivalentes a 612 × 792 puntos. Incluye A4 configurable,
210 × 297 mm. Conserva compatibilidad con formatos anteriores necesarios para
documentos históricos. Media carta y A5 no son sinónimos.

Comienza con márgenes de 12 mm y texto de detalle alrededor de 10–11 puntos;
comprueba el área imprimible del perfil real. Son parámetros de diseño, no evidencia
de compatibilidad con una impresora aún no probada.

Composición requerida: encabezado institucional compacto con logo autorizado y
datos reales; tipo/número/fecha claramente destacados; paciente y contexto del pago;
tabla de descripción, cantidad, precio e importe; resumen monetario legible; método
y referencia aplicables; espacios de firma/sello; etiqueta de copia y numeración de
página cuando corresponda.

Usa blanco y negro como prueba principal de legibilidad, separadores discretos y
alineación monetaria. No consumas tinta en fondos decorativos. No inventes RTN, CAI,
tasas, firmas, sellos o logos para completar espacios.

Nombres y descripciones largos deben envolver correctamente. Pagina los comprobantes
extensos, repite encabezados útiles e identifica continuaciones; no reduzcas todo a
texto microscópico. Verifica montos en letras cuando existan, signos, acentos y
formatos locales.

Genera previews y PDFs reales desde el motor de producción con casos sintéticos
cortos, largos, cero, anulados y reimpresos. Comprueba dimensiones del PDF, páginas,
cortes y totales. No presentes un mockup o screenshot como comprobante implementado.

Versiona plantilla y configuración relevante. Los documentos antiguos no deben
cambiar silenciosamente de contenido al modificar el catálogo o rediseñar los
nuevos.

### 13. Impresión, copias y recuperación

Diseña un flujo explícito: documento guardado → vista previa disponible → imprimir →
recuperar/reimprimir si hace falta. Imprimir no debe volver a emitir un documento ni
consumir otro número.

Ofrece ORIGINAL, PRIMERA COPIA y SEGUNDA COPIA mediante configuración clara, con el
mismo número de documento. Indica cuántas páginas/copias generará el PDF. Si la
aplicación genera tres copias, el diálogo debe indicar una copia del conjunto para
evitar multiplicaciones accidentales.

Registra por separado emisión, solicitud/generación para impresión, descarga y
reimpresión. No declares que el papel salió porque se abrió o cerró el diálogo del
navegador. La copia de un PDF ya descargado tampoco está completamente controlada
por la aplicación.

Toda reimpresión desde el sistema debe pasar por autorización, motivo auténtico,
contador persistente y marca visible. El contador no puede depender de logs que se
podan. Cubre también los caminos legacy, links directos y eventos concurrentes.

Maneja popup bloqueado, descarga alternativa, impresora sin papel, cancelación,
cambio de impresora y fallos del PDF. La configuración del sistema puede seleccionar
diseño y perfil, pero no debe fingir control universal de las impresoras de Windows
desde un navegador. Un puente nativo o modo administrado sería una decisión
explícita, no dependencia oculta.

### 14. Configuración y primer uso

Crea una configuración inicial breve para el administrador: identidad institucional
real, cuenta inicial segura, modo una PC/LAN, caja/terminal, papel/copias y
respaldo. Permite reanudarla después de un reinicio sin repetir pasos ni regenerar
secretos existentes.

No uses contraseñas universales, registro público o recuperación dependiente de
email externo. Protege el bootstrap para que un cliente LAN no tome la instalación
antes del administrador. Distingue el modo de capacitación con datos sintéticos del
sistema operativo con datos reales.

Para cajeros, prioriza una interfaz evidente y ayuda contextual corta. No fuerces un
tour largo cada vez que ingresan. Incluye una guía local para cobrar, imprimir,
cerrar caja y actuar ante fallos; la capacitación complementa el producto, no excusa
una interfaz confusa.

Separa configuración cotidiana de mantenimiento peligroso. Cambiar un margen no debe
requerir editar archivos, y restaurar la base no debe aparecer como una acción
inocua junto a "Imprimir prueba".

### 15. Seguridad, integridad y privacidad

Revalida permisos de servidor en endpoints, reportes, búsquedas, exportaciones,
recibos y administración. Prueba acceso horizontal entre cajeros/cajas y escalada
vertical entre roles reales. No importes al hospital la matriz de tenants del ejemplo
CRM.

Mantén correlativos y pagos protegidos con transacciones, restricciones únicas y
locks apropiados. Revisa orden de locks, deadlocks, reintentos e idempotencia.
Verifica consistencia entre centavos y decimales, y restricciones sobre estados y
relaciones. No cambies el motor a SQLite para simplificar una instalación
multiusuario.

Conserva auditoría y datos históricos; los usuarios se desactivan según el contrato
vigente, sin borrar autoría. Revisa logs, exportaciones, cachés y PDFs para evitar
exposición innecesaria. No recolectes datos clínicos adicionales sin necesidad
definida.

Implementa una ruta segura de HTTPS en LAN con aprovisionamiento y confianza de
certificados cuando sea el modo adoptado. Protege la clave de la autoridad local; no
la distribuyas a clientes. No soluciones errores de conexión deshabilitando CSRF,
CORS, firewall o validación TLS globalmente. La base de datos no se publica a todas
las computadoras.

No consideres seguro `frontend/.env.production` solo por su nombre: inspecciona el
uso efectivo sin divulgar valores. Un dato embebido en el frontend debe ser realmente
público.

### 16. Instalación offline sencilla, con requisitos reales

Entrega un recorrido de instalación para el operador, no instrucciones de
desarrollo. Objetivo: abrir un instalador validado, completar los pasos
indispensables y abrir el sistema; los clientes LAN solo necesitan navegador
compatible y configuración de confianza/conectividad cuando corresponda.

Inspecciona la ruta de empaquetado ya existente. Selecciona una única ruta principal
mantenible y prueba su ciclo completo. No reescribas Laravel/React para simular
portabilidad ni mantengas tres runtimes inconclusos.

Comprueba Windows soportado, permisos, virtualización cuando aplique, espacio,
memoria, conflictos de puertos, drivers y reinicios. Automatiza la preparación
legalmente distribuible; explica y guía aquello que requiera administrador, firmware
o reinicio. "Sin pasos técnicos manuales para el cajero" no significa "sin runtime".

Revisa las licencias actuales del runtime. Docker Desktop exige suscripción para
entidades gubernamentales; no presupongas una exención por tratarse de un hospital.
Docker Engine y Docker Desktop no tienen las mismas condiciones. No compres licencias
ni cambies silenciosamente el sistema operativo: documenta la decisión y deja
claramente separada cualquier aprobación institucional necesaria.

El paquete offline debe contener los artefactos de ejecución necesarios: frontend
compilado, dependencias, imágenes o runtime autorizado, scripts, recursos y manual
local. No debe ejecutar npm/composer install, descargar de registries o compilar en
la PC del hospital para completar la instalación normal.

Verifica integridad antes de cargar imágenes y ejecutar componentes. Incluye
manifiesto de versiones y hashes con una fuente de confianza; un hash junto a un
archivo no equivale por sí solo a firma/autenticidad. No metas datos reales,
credenciales de desarrollo ni dumps de pruebas en el paquete.

Prueba instalación desde una VM Windows limpia y soportada, con salida a Internet
bloqueada desde antes de iniciar. Cubre instalación parcial, reinicio requerido,
reanudación, cambio de ruta, actualización preservando datos y desinstalación sin
borrado automático de la base.

Comprueba arranque tras reinicio del equipo, antes de sesiones técnicas interactivas,
y recuperación de servicios caídos. No confundas un acceso directo o una política de
restart de contenedores con prueba de que el runtime completo arranca solo. No
habilites autologin inseguro como atajo.

### 17. Red local y operación diaria

La pantalla de estado debe mostrar de forma autorizada modo operativo, dirección de
acceso y diagnóstico entendible. Configura origen/API/cookies/realtime de modo
consistente; no obligues a recompilar el frontend por cada dirección LAN.

Verifica un cliente en una segunda máquina o VM, no solo dos pestañas del servidor.
Prueba autenticación, dos operadores, cobros concurrentes en cajas distintas,
reportes y reconexión. Cuando solo haya contextos de navegador disponibles, describe
el alcance limitado de esa evidencia.

Limita reglas de firewall a los perfiles/puertos/subredes necesarios. No abras toda
la red ni dependas de DNS público. Documenta reserva DHCP/IP estable o resolución
local elegida y qué ocurre si cambia.

Incluye señales de estado para servidor, base, colas, scheduler y backups. Los avisos
operativos deben funcionar sin Internet; un correo externo puede ser complemento, no
el único mecanismo de alerta.

### 18. Backups, actualización y recuperación

Un respaldo se valida restaurándolo. Comprueba contenido, consistencia, cifrado,
integridad, retención, copia fuera del disco del servidor y custodia recuperable de
las claves. No regeneres una clave durante una actualización perdiendo acceso al
histórico.

Cuando falte USB/NAS/destino externo, implementa y prueba el flujo con un destino de
laboratorio, pero declara pendiente la configuración real. Nunca marques "copia
externa protegida" si todo permanece en el mismo disco.

Calcula el intervalo real entre backups y mide recuperaciones. Separa objetivos
propuestos de RPO/RTO observados; no copies cifras históricas sin recalcularlas.
Prueba fallo de backup, disco lleno, clave ausente, archivo alterado, retención y
alerta.

Toda actualización sobre datos existentes debe verificar un backup apropiado y
recuperable antes de migrar. Prueba instalaciones nuevas y actualizaciones por
separado. No asumas que volver al ejecutable anterior revierte una migración
incompatible.

En restauración detén escritores de forma controlada, valida destino, recupera en un
entorno desechable, verifica saldos/cajas/documentos/auditoría y registra resultados.
Reanuda operaciones solo después de validar integridad. No ejecutes ensayos
destructivos contra producción.

Restaurar un backup antiguo puede perder documentos cuyos papeles siguen existiendo.
Define reconciliación y recuperación de correlativos antes de volver a facturar; no
basta con "restaurar el último archivo disponible".

### 19. Validación técnica actual

Ejecuta lint, typecheck, build, pruebas unitarias, integración y E2E aplicables. Usa
comandos reales del proyecto. No elimines assertions, reduzcas cobertura o desactives
tipos para obtener verde. Un test incorrecto puede corregirse solo con evidencia y
revisión.

Para cada PASS importante registra comando, resultado/exit code, fecha, revisión o
hash del árbol probado y artefacto. Separa resultados antiguos de la ejecución actual.
Un cambio posterior invalida las pruebas afectadas.

El job MariaDB debe demostrar el driver y servidor efectivos desde el mismo
proceso/conexión de prueba. Exige pruebas realmente ejecutadas de locks, índices,
columnas generadas y triggers; no basta con levantar un servicio MariaDB mientras
PHPUnit usa SQLite.

Cubre solicitudes concurrentes con procesos/conexiones independientes, sincronización
reproducible y datos aislados. Prueba doble clic, misma clave/diferente payload, retry
tras commit, dos cajeros, cierre contra cobro y anulaciones simultáneas. Las pruebas
sobre strings del código no reemplazan carreras reales.

Los recorridos centrales E2E deben usar backend y base reales de laboratorio. Mocks
sirven para estados controlados, pero no demuestran persistencia, autorización ni
integridad. Añade pruebas negativas y comprueba que realmente pueden detectar el
defecto correspondiente.

### 20. Matriz mínima de aceptación

| Área                  | Evidencia exigida                                                                |
| --------------------- | -------------------------------------------------------------------------------- |
| Acceso y roles        | Login, expiración, cambio de contraseña y denegaciones por API con roles reales. |
| Facturación y caja    | Flujo completo, arqueo, cierre, anulaciones y conciliación reproducible.         |
| Dinero y concurrencia | Casos límite y operaciones concurrentes sin duplicaciones ni saldos imposibles.  |
| Impresión             | PDFs reales, tamaños, paginación, copias, permisos, reimpresión y cancelación.   |
| Offline               | WAN bloqueada, login nuevo, refresh, cobro, PDF, reportes y backup funcionales.  |
| LAN                   | Segundo cliente, usuarios simultáneos y separación correcta de cajas.            |
| Recuperación          | Restore limpio, actualización fallida/rollback y claves verificadas.             |
| Instalador            | VM soportada limpia, instalación offline, reanudación y reinicio.                |
| UI y accesibilidad    | Todas las rutas, estados, teclado, zoom, responsive y pruebas diferenciadas.     |
| Seguridad             | Acceso indebido, manipulación de IDs/importes y exposición de datos bloqueados.  |

Para impresión física, escáneres de accesibilidad, pantalla, red y hardware, informa
qué dispositivo/herramienta fue realmente utilizado. No marques pruebas físicas como
PASS por inspeccionar HTML, un PDF o una captura.

### 21. Rendimiento, mantenimiento y dependencias

Mide latencia de las tareas centrales, búsquedas, reportes y PDF con datasets
sintéticos de tamaño declarado y concurrencia representativa. Incluye p50/p95,
errores, CPU/memoria y configuración de la máquina. No afirmes capacidad para el
hospital basándote solo en una tabla con diez registros.

Empieza con una carga pequeña reproducible y escala, por ejemplo, a historiales
amplios y varios usuarios concurrentes. Son perfiles de prueba, no volumen
hospitalario confirmado. Distingue escrituras simultáneas de consultas; no hagas
pruebas de carga en producción.

Ataca N+1, consultas sin paginar, renders innecesarios, polling redundante y módulos
gigantes cuando afecten mantenibilidad o respuesta. Divide componentes por
responsabilidades sin romper contratos. No uses cantidad de líneas o archivos como
medida de progreso.

Comprueba versiones bloqueadas, compatibilidad, vulnerabilidades relevantes y
licencias. No actualices dependencias indiscriminadamente. Si la base de
vulnerabilidades está desactualizada por falta de red, no presentes un resultado
vacío como seguridad demostrada.

### 22. Revisión adversarial y cierre del rediseño

Después de integrar, `hs-review` debe intentar refutar el informe de los
implementadores. Selecciona flujos reales, prueba permisos directamente, compara lo
visible con lo persistido y busca afirmaciones sin evidencia.

Comprueba rutas inaccesibles, formularios sin persistencia, pantallas respaldadas
solo por mocks, pruebas ignoradas, flags que desactivan validación, datasets de
demostración en producción y reportes construidos con resultados antiguos.

Para defectos confirmados: registra el hallazgo, escribe una regresión que falle,
corrige la causa y vuelve a probar. Mantén IDs estables y evidencia de cierre. El
mismo implementador no puede aprobar su propio trabajo como revisión independiente.

Realiza además una pasada visual por todas las superficies, con las dos skills
releídas. Revisa textos largos, vacíos, carga, error, foco, diálogos, navegación,
tabla, zoom e impresión. Las búsquedas automáticas de patrones CSS son indicios, no
autorización para reemplazos ciegos.

La interfaz no queda "para después" porque el backend pase. Tampoco se acepta una UI
hermosa sin cobros, permisos y recuperación fiables.

### 23. Macro-lotes y continuidad

Organiza la ejecución en bloques conectados: A) estado actual, coordinación, skills
y contratos; B) integridad, runtime y recuperación prioritarios junto con diseño
base; C) rediseño e integración de todos los flujos y comprobantes; D) instalación
offline, LAN y operación; E) revisión adversarial, rendimiento y polish; F)
congelación, certificación y entrega.

Ajusta dependencias según evidencia; no esperes terminar un bloque independiente para
aprovechar otro agente. Cada bloque concluye con integración y reparación de
regresiones, no solo reportes de especialistas.

Mantén pocos documentos vivos, reutilizando equivalentes existentes: estado actual,
tablero de trabajo, contratos/diseño y evidencia/handoff. El tablero relaciona
requisito, responsable, dependencia, archivos, pruebas, estado y blocker. Evita
duplicar veinte informes inconsistentes.

No cierres la sesión simplemente por completar un plan o un módulo. Continúa con el
siguiente trabajo ejecutable. Si llega un límite real de contexto/herramientas, guarda
un checkpoint preciso para reanudar, no prometas seguir trabajando fuera de la sesión
ni reinicies la auditoría desde cero.

### 24. Entrega, estados y definición de terminado

Entrega un sistema integrado, no piezas aisladas. Todos los módulos del alcance deben
tener implementación, contratos y evidencia. Los defectos críticos/altos conocidos
bloquean una declaración de producción hasta ser resueltos o explícitamente tratados
por la autoridad correspondiente; no los reclasifiques para conseguir verde.

Distingue cuatro estados: IMPLEMENTACIÓN DEL ALCANCE, VALIDACIÓN TÉCNICA ACTUAL,
VALIDACIÓN EN WINDOWS/LAN/IMPRESORA OBJETIVO y APROBACIÓN PARA ENTREGA. Usa PASS,
FAIL, PARTIAL o NOT VERIFIED por comprobación, con justificación.

Congela la revisión candidata y calcula hashes. Certifica y promueve exactamente ese
artefacto; no recompiles después y reutilices la certificación de otro binario. No
edites manualmente resultados para simular una prueba ejecutada.

El informe final debe indicar qué cambió, qué se conservó, diseño aplicado,
instrucciones reales de instalación/uso, pruebas actuales y blockers específicos.
Incluye capturas y PDFs de prueba sin datos reales cuando existan. No reveles
credenciales en el handoff.

Genera `HANDOFF_ACTUAL_CHATGPT.md`, autocontenido: identidad del workspace y revisión;
stack/versiones; arquitectura/servicios; esquema crítico; roles; inventario completo
de rutas y estados; flujos de caja; contratos monetarios; impresión y plantilla;
modelo de operación LAN; instalación; backup/restore; pruebas y artefactos; hallazgos
cerrados/abiertos; archivos/símbolos relevantes; comandos y dependencias externas.
Diferencia claramente lo verificado de lo inferido.

Empieza ahora. Comprueba el estado actual, ajusta la coordinación autorizada, carga
las skills, lanza especialistas reales y ejecuta. No hagas otra demo, no reduzcas el
alcance silenciosamente y no te detengas en una auditoría. Termina todo lo que pueda
implementarse y verificarse en este entorno, y deja inequívoco lo que requiere
comprobación física o aprobación institucional.
