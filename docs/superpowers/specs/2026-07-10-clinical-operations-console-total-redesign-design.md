# S_Hospital — Clinical Operations Console

Fecha: 2026-07-10

Estado: dirección visual aprobada; especificación escrita pendiente de revisión

Producto: sistema hospitalario offline para facturación, caja, contabilidad
operativa, recibos, reportes y administración

## 1. Decisión de producto

S_Hospital recibirá un **rediseño visual y de experiencia total**, no un ajuste
cosmético. Se reemplazarán el lenguaje visual, el shell, la navegación, las
composiciones de página, la jerarquía, los componentes compartidos, las tablas,
los formularios, los diálogos, los estados y los flujos de trabajo de todas las
rutas visibles.

El resultado se llamará **Clinical Operations Console**: una interfaz clínica,
editorial y operacional, sobria pero reconocible, diseñada para uso continuo en
un hospital y no para parecer una plantilla administrativa genérica.

El rediseño conserva como contratos inmutables:

- las reglas de dinero, impuestos, numeración fiscal y redondeo del backend;
- los estados y transacciones de facturas, pagos, caja y anulaciones;
- los permisos, Policies/Gates, auditoría e idempotencia;
- los contratos API existentes salvo que una mejora funcional requiera una
  extensión compatible y probada;
- la operación offline en LAN con React, Laravel y MySQL/MariaDB;
- el contrato de impresión: el usuario elige papel y el sistema decide todas las
  medidas técnicas.

La interfaz actual no es una restricción de diseño. No se conservarán pantallas,
cards o layouts solo porque ya existan. Sí se conservará lógica probada cuando
sea correcta, separándola de su presentación.

## 2. Resultado esperado

La aplicación debe sentirse como un instrumento de trabajo hospitalario:

- el cajero reconoce su próxima acción en menos de tres segundos;
- el dato dominante de cada pantalla tiene peso visual inequívoco;
- las excepciones —pendientes, diferencias, anulaciones, errores y riesgos— se
  distinguen sin depender solo del color;
- la información secundaria existe bajo demanda y no compite con el trabajo;
- una acción principal por contexto evita filas de botones equivalentes;
- las operaciones frecuentes son rápidas con ratón, tacto, lector o teclado;
- las áreas administrativas se sienten parte del mismo producto, no formularios
  desconectados;
- ninguna ruta termina con restos del diseño anterior.

## 3. Lenguaje visual

### 3.1 Dirección estética

La dirección combina **editorial clínico** con **panel operacional**:

- fondos cálidos casi blancos, no gris SaaS;
- tinta azul noche para estructura y lectura prolongada;
- verde quirúrgico para continuidad operativa y acciones confirmadas;
- ámbar para atención y conciliación;
- rojo reservado para pérdida, anulación, bloqueo o peligro real;
- superficies planas con divisores nítidos y elevación solo cuando comunica una
  capa interactiva;
- números financieros grandes, alineados y tabulares;
- más ritmo tipográfico y menos mosaicos de cards iguales;
- fotografía, gradientes decorativos, glassmorphism, neón y ornamentos de
  marketing quedan fuera del producto operativo.

### 3.2 Paleta semántica inicial

Los valores se validarán en contraste antes de fijarse como tokens:

| Rol | Claro | Oscuro | Uso |
| --- | --- | --- | --- |
| Canvas | `#F5F7F6` | `#0B1218` | Fondo general |
| Surface | `#FFFFFF` | `#111B23` | Superficie de trabajo |
| Ink | `#10212B` | `#EDF4F2` | Texto dominante |
| Muted | `#5D6B72` | `#AEBBC0` | Texto secundario |
| Line | `#D7DFDD` | `#2A3840` | Divisores y controles |
| Clinical | `#087F71` | `#4EC9B6` | Acción primaria y éxito |
| Navy | `#163A59` | `#8DB9D8` | Navegación y énfasis |
| Attention | `#A85D08` | `#F2B35F` | Pendientes y diferencias |
| Danger | `#B42318` | `#FF8A80` | Anulación, error y riesgo |

Los tokens de color no se consumirán por nombre cromático en features. Los
componentes usarán roles como `surface`, `action`, `pending`, `danger`,
`reconciled` o `disabled`.

### 3.3 Tipografía y números

- **IBM Plex Sans Variable**, empaquetada dentro del build, será la familia de
  interfaz. Tiene una voz técnica e institucional más propia que la tipografía
  genérica actual.
- Las cifras monetarias usarán variantes tabulares y alineación por decimal.
- La jerarquía no dependerá de seis tamaños parecidos: título de contexto,
  lectura principal, etiqueta operacional y metadato serán niveles explícitos.
- El cuerpo mínimo será 16 px en formularios y 14 px en tablas de escritorio;
  textos críticos nunca se reducirán para “hacerlos caber”.
- Los importes usarán `L 0.00` con espacio inseparable y formateo `es-HN`.

### 3.4 Iconos y marca

Se mantendrá `lucide-react` durante la primera implementación porque ya está
instalado, cubre el vocabulario del producto y evita dos sistemas de iconos. El
rediseño sustituirá su uso inconsistente mediante un catálogo central de iconos,
tamaños y pesos. La personalidad provendrá de composición, tipografía, color,
densidad y detalle operacional; no de cambiar una biblioteca por novedad.

La identidad del hospital aparecerá de forma contenida en login, navegación y
recibos. El logotipo nunca reducirá el espacio de operación ni se repetirá en
cada panel.

## 4. Librerías y política offline

Las librerías se incorporan porque resuelven problemas concretos. Todo el código,
CSS, fuentes e iconos queda incluido en el build local; ninguna requiere CDN ni
servicio externo en producción.

| Librería | Decisión | Problema que resuelve |
| --- | --- | --- |
| shadcn/ui + Radix | Adoptar como fuente editable, no tema prefabricado | Componentes accesibles, composables y totalmente estilables |
| `motion` | Adoptar con `LazyMotion` | Transiciones de estado y continuidad espacial sin cargar todo el motor al inicio |
| `@tanstack/react-virtual` | Adoptar | Listas y tablas largas sin renderizar miles de nodos |
| `@fontsource-variable/ibm-plex-sans` | Adoptar | Tipografía institucional local y reproducible |
| `cmdk` mediante Command | Adoptar | Paleta de navegación y acciones rápidas por permisos |
| `sonner` | Adoptar y retirar `react-hot-toast` | Un solo canal breve de confirmaciones no críticas |
| TanStack Query/Table | Mantener | Cache, sincronización y tablas con modelo explícito |
| React Hook Form + Zod | Mantener y normalizar | Formularios con validación y errores accesibles |
| Recharts | Mantener | Gráficas secundarias con equivalentes textuales |

La instalación de shadcn se hará sobre el Vite existente. No se sustituirá la
aplicación ni se aceptará un preset visual como resultado final: sus archivos
generados se convertirán en componentes propios del repositorio.

## 5. Arquitectura de frontend

La estructura objetivo separa sistema visual, shell, patrones operativos y
dominio:

```text
frontend/src/
  design-system/
    tokens/          color, tipo, espacio, radio, elevación, movimiento
    primitives/      button, field, dialog, sheet, menu, tabs, table
    patterns/        page, toolbar, ledger, detail-panel, form, states
    icons/           catálogo semántico único
    motion/          presets y proveedor de reduced-motion
  shell/
    navigation/      rail, mobile dock, command palette, breadcrumbs
    status/          sesión, caja, red, usuario y alertas
  features/
    ...              composición y comportamiento por dominio
  modules/
    ...              reglas de aplicación reutilizables sin presentación
```

Los directorios existentes podrán migrarse gradualmente, pero el estado final no
tendrá dos design systems. `components/ui` y `components/shared` se absorberán o
se convertirán en reexportaciones temporales que se eliminan antes del cierre.

Reglas de composición:

- los primitives no conocen facturas, caja ni permisos;
- los patterns conocen estructuras de interacción pero no contratos API;
- las features coordinan datos, permisos y casos de uso;
- las reglas de dinero, recibos, conciliación y acciones permanecen en módulos
  probados;
- no se duplica lógica fiscal en componentes visuales;
- no se añaden props booleanas en cascada para crear variantes; se prefieren
  composición, slots y variantes semánticas.

## 6. Nuevo shell y navegación

### 6.1 Escritorio

La navegación será un **rail clínico compacto** de ancho fijo, con identidad,
grupos operativos y administrativos, icono más etiqueta, y estado activo con
forma y contraste. El rail puede reducirse a iconos, pero la preferencia se
recuerda por usuario.

Una barra de contexto superior contendrá únicamente:

- breadcrumb o título de tarea;
- estado de caja cuando sea relevante;
- estado de conexión solo cuando cambie o falle;
- acceso a búsqueda/comandos;
- menú de sesión y usuario.

Se eliminan duplicados de hospital, usuario, conectividad y caja. Ningún estado
aparece simultáneamente en sidebar, topbar y contenido.

### 6.2 Paleta de comandos

`Ctrl/Cmd + K` abre una paleta local que contiene solo acciones permitidas:
navegar, crear factura, abrir caja, buscar factura, ir a reportes y abrir ayuda.
No ejecuta operaciones destructivas ni guarda formularios. Las acciones se
cargan desde el catálogo central de rutas y permisos para evitar divergencias.

### 6.3 Tablet y móvil

- Tablet usa rail reducido y paneles superpuestos.
- Móvil usa encabezado compacto y dock de hasta cuatro destinos por rol; el
  resto vive en un sheet.
- Las acciones primarias permanecen alcanzables en el borde inferior sin cubrir
  contenido.
- El shell y todas las rutas funcionan desde 320 px sin scroll horizontal de
  página. Una tabla que no cabe cambia a lista estructurada o permite scroll en
  su región etiquetada, nunca en todo el documento.

## 7. Rediseño por ruta y flujo

### 7.1 Autenticación y cambio de contraseña

Login será una composición dividida y silenciosa: identidad institucional y
estado local a un lado; formulario de acceso enfocado al otro. No habrá texto de
marketing. El campo de contraseña ofrece mostrar/ocultar, bloqueo de mayúsculas,
errores junto al control y foco seguro. El cambio obligatorio de contraseña
mantiene la misma jerarquía y explica requisitos antes de enviar.

### 7.2 Inicio

Inicio deja de ser una cuadrícula uniforme. La composición será asimétrica:

1. franja operacional con turno, caja y acción siguiente;
2. resumen de hoy con ingresos, cobros, pendientes y anulaciones;
3. cola de atención: pendientes, diferencias o tareas de configuración;
4. actividad reciente con enlaces al registro original;
5. accesos secundarios según permisos.

Si un rol no puede ver cifras financieras, el espacio se recompone; no muestra
cards vacías. Los charts no ocupan el primer plano si una cifra o lista responde
mejor.

### 7.3 Nueva factura

En escritorio será una estación de trabajo de tres zonas:

- **Contexto**: paciente, receta de diálisis y datos mínimos obligatorios;
- **Servicios**: búsqueda inmediata, categorías, favoritos recientes y lector;
- **Cuenta**: ticket persistente con cantidades, precios, total y acción de
  cobro.

El nombre del paciente permanece visible sin repetir un formulario completo. La
eritropoyetina de L.25 muestra claramente el resultado de la receta de diálisis
y nunca permite al frontend inventar el total final.

En tablet se combinan contexto y servicios, con cuenta en panel persistente. En
móvil el mismo flujo se expresa como pasos cortos: paciente, servicios, revisar
y cobrar, preservando el borrador al volver atrás.

El servicio se agrega con una acción; teclado o lector no abren diálogos
innecesarios. El total definitivo llega del backend. Doble envío queda bloqueado
visual y transaccionalmente.

### 7.4 Cobro y resultado

Cobro será un diálogo o drawer de secuencia única:

1. total a cobrar;
2. método de pago;
3. monto recibido y cambio solo cuando aplica;
4. referencia solo cuando el método la requiere;
5. confirmación inequívoca.

El resultado exitoso no es un toast: es un estado persistente con número de
factura, paciente, total, método y acciones reales para imprimir, guardar PDF,
nueva factura o ir al historial. Un fallo conserva la información ingresada y
explica si es reintentable.

### 7.5 Caja y contabilidad operativa

Caja será un libro operacional, no un conjunto de indicadores dispersos:

- cabecera de sesión con cajero, apertura, fondo y estado;
- resumen alineado de esperado, contado, diferencia y composición por método;
- movimientos cronológicos con filtros y vínculo a factura/pago;
- panel de cierre con conteo, observación, conciliación y confirmación auditada;
- estados claramente diferentes para caja cerrada, propia, ajena y sin permiso.

La contabilidad visible integrará ingresos, métodos, pendientes, anulaciones,
cierres, diferencias y exportaciones desde los datos existentes. **Egresos no se
simularán**: si el backend no tiene un modelo transaccional auditado, la interfaz
indicará que no forman parte de la contabilidad operativa actual y no mostrará
botones falsos. Incorporarlos requerirá migración, permisos, auditoría y pruebas
de dominio en una fase funcional explícita.

### 7.6 Historial de facturas

La pantalla tendrá barra de búsqueda y filtros persistentes, resumen de alcance,
tabla densa en escritorio y lista estructurada en móvil. La selección abre un
panel de detalle sin perder filtros ni scroll.

Las acciones se organizan por frecuencia y riesgo: ver, imprimir/reimprimir,
descargar, cobrar pendiente y anular. Anular exige permiso, motivo, impacto
visible y confirmación; nunca se elimina una factura.

### 7.7 Catálogo de servicios

Catálogo será un master-detail rápido:

- búsqueda, categoría, estado y acción de alta en una barra compacta;
- lista virtualizada con nombre, categoría, precio, estado y capacidad de
  lectura;
- edición en sheet lateral con secciones de identidad, precio, escáner y cambios
  auditados;
- creación y edición comparten schema y estructura;
- el estado activo/inactivo es legible y no depende de una opacidad baja.

### 7.8 Reportes

Reportes será un lienzo editorial con subrutas claras: ejecutivo, caja y
auditoría. Cada subruta tendrá:

- filtros compactos y persistentes en URL;
- periodo y alcance siempre visibles;
- cifras principales en una línea contable, no en cards repetidas;
- chart únicamente cuando revela tendencia o distribución;
- tabla equivalente y exportación con el mismo alcance aplicado;
- vacíos que diferencian “sin actividad” de “sin permiso” o “error”.

El reporte de caja muestra cierres y diferencias; el ejecutivo muestra ingresos,
pendientes, anulaciones, métodos y servicios; auditoría permite seguir actor,
acción, entidad, fecha y motivo sin exponer datos innecesarios.

### 7.9 Configuración fiscal y operativa

Configuración será un espacio de alto riesgo con navegación local por secciones:
institución, fiscalidad, numeración y reglas operativas. Cada formulario muestra
qué cambia, a quién afecta y desde cuándo. Secciones de solo lectura y edición
tendrán apariencia distinta.

Guardar cambios críticos requiere resumen y confirmación contextual. Los campos
no exponen nombres técnicos de base de datos. Errores del backend se asignan al
campo correcto o a un resumen enfocable.

### 7.10 Recibos e impresión

La configuración principal ofrece únicamente tarjetas de papel:

- Carta;
- Media carta;
- A5.

Cada opción muestra proporción, uso recomendado y previsualización real. El
sistema controla márgenes, fuente, escala, saltos y área imprimible. 80 mm y 58
mm quedan como compatibilidad secundaria, visualmente separada, si el contrato
actual los soporta.

La vista previa usa el mismo modelo de presentación que PDF/impresión. El recibo
principal incluye paciente y datos institucionales, y no expone QR, código de
barras ni identificadores internos. Las pruebas incluyen snapshot visual por
papel y verificación física o PDF renderizado.

### 7.11 Usuarios, roles y permisos

Usuarios será master-detail: directorio a la izquierda, identidad/estado/roles a
la derecha. Alta, edición, cambio de contraseña y activación comparten patrones.

Roles muestra primero perfiles comprensibles y después una matriz avanzada. Los
permisos de alto riesgo —anulación, caja ajena, fiscalidad, roles, respaldos— se
marcan con explicación de impacto. La UI nunca concede acceso por ocultar un
botón: el backend sigue autorizando cada acción.

### 7.12 Respaldos

Respaldos mostrará salud, última ejecución, siguiente ejecución conocida y una
línea de tiempo de archivos locales. Crear respaldo manual será la acción
principal cuando exista permiso; descargar será secundaria.

No se ofrecerán restauración o borrado si el backend no implementa un flujo
seguro y auditado. Un respaldo fallido muestra diagnóstico accionable para el
técnico, sin exponer rutas o secretos al usuario normal.

### 7.13 Ayuda, soporte y acerca de

Ayuda será buscable y orientada a tareas por rol. Soporte reunirá estado del
servidor, base de datos, versión, conectividad LAN y procedimientos de incidencia
con divulgación progresiva. Acerca de incluirá versión y build verificables, no
texto promocional ni placeholders.

### 7.14 Estados globales

404, acceso denegado, sesión vencida, offline, error inesperado, carga y vacío
reciben composiciones propias. Todos ofrecen una explicación humana, una próxima
acción real y un identificador técnico solo cuando ayuda al soporte.

## 8. Interacción, movimiento y feedback

Motion se usará para continuidad, no decoración:

- entrada/salida de sheets y diálogos;
- transición entre pasos de cobro y facturación móvil;
- inserción o retirada de una línea del ticket;
- expansión de detalle y cambio de estado confirmado;
- transición de ruta corta cuando no retrasa el contenido.

Duraciones: 120–180 ms para controles, 180–240 ms para paneles. No habrá
animaciones continuas, rebotes, parallax ni retrasos secuenciales en tablas. Con
`prefers-reduced-motion`, todo movimiento no esencial se elimina.

Feedback:

- resultado de operación crítica: estado persistente en contexto;
- confirmación breve no crítica: Sonner;
- validación: junto al campo y resumen cuando hay varios errores;
- actividad en curso: label específico, no spinner sin significado;
- progreso largo: etapa actual y posibilidad de continuar trabajando cuando sea
  seguro.

## 9. Accesibilidad

Objetivo: WCAG 2.2 AA en rutas y flujos críticos.

- foco visible con contraste en todos los controles;
- orden de tabulación igual al orden visual y de trabajo;
- áreas táctiles de al menos 44 × 44 px para acciones principales;
- labels persistentes; placeholder nunca funciona como label;
- títulos, landmarks y tablas semánticas;
- diálogos con foco inicial correcto, trampa de foco y retorno al disparador;
- mensajes de estado anunciados sin duplicación;
- color acompañado por texto, icono o forma;
- contraste validado en estados hover, disabled, focus y selected;
- charts con título, resumen y tabla o lista equivalente;
- zoom de 200 % y reflow de 320 CSS px sin pérdida de operación;
- teclado completo para factura, cobro, historial, caja y command palette;
- español de Honduras consistente y sin cadenas rotas por codificación.

## 10. Rendimiento percibido y real

El rediseño no puede comprar estética con lentitud.

- todas las rutas no críticas permanecen lazy-loaded;
- Facturación y Caja también se separarán en chunks si la medición confirma que
  el shell inicial mejora sin penalizar el acceso frecuente;
- `LazyMotion` carga únicamente las características de movimiento usadas;
- listas extensas usan virtualización, paginación del servidor o ambas;
- filtros de escritura se difieren o cancelan sin bloquear el input;
- skeletons reflejan la geometría final y no causan saltos grandes;
- fuentes locales usan solo los pesos/ejes necesarios;
- no se envían imágenes decorativas ni assets remotos;
- las consultas usan claves estables, caché explícita y polling únicamente donde
  el estado operacional lo necesita.

Presupuestos iniciales que el plan convertirá en checks reproducibles:

- ninguna regresión de Lighthouse Accessibility por debajo de 95 en rutas
  representativas;
- cero overflow horizontal a 320, 768, 1024, 1366 y 1920 px;
- cero tarea larga atribuible a render de una tabla de 1,000 filas usando datos
  de prueba;
- tamaño y chunks del build registrados antes/después; toda dependencia nueva
  debe justificar su costo;
- búsqueda y agregado de servicio deben responder visualmente en el mismo frame
  en hardware de referencia LAN.

## 11. Estrategia de sustitución

El trabajo se ejecutará internamente en olas pequeñas y verificables, pero se
entregará como un sistema coherente:

1. baseline visual, de rendimiento y de rutas;
2. tokens, tipografía, primitives, patterns y laboratorio de estados;
3. shell, navegación, comandos, feedback y autenticación;
4. estación de facturación, cobro, recibo y estados de resultado;
5. caja, contabilidad operativa, historial y catálogo;
6. reportes, fiscalidad, recibos, usuarios y respaldos;
7. ayuda, soporte, estados globales y responsive completo;
8. limpieza del diseño anterior, pruebas visuales, accesibilidad, rendimiento y
   quality gate total.

Durante una ola pueden existir adaptadores temporales. En la entrega final no
quedan componentes visuales legacy, dos toasters, dos escalas tipográficas ni
dos patrones para el mismo control.

Para no volver a perder tiempo:

- se prueba el componente o flujo tocado después de cada cambio;
- se captura una matriz visual por ola, no se reinicia toda la suite por cada
  archivo;
- lint/typecheck se ejecutan sobre alcance durante desarrollo;
- el gate completo se ejecuta al cerrar cada flujo crítico y una vez al final;
- cada ola termina en un commit Conventional Commit coherente;
- las regresiones se corrigen donde aparecen, sin acumular una fase de “pulido”.

## 12. Pruebas y evidencia

### Unitarias y componentes

- variantes, foco, estados, formularios y responsive de los nuevos patterns;
- factura, ticket, cobro, éxito, recibo, caja, cierre y diferencia;
- permisos de acciones, navegación y command palette;
- estados vacíos, error, offline y carga;
- accesibilidad con Testing Library, `jest-dom`, `vitest-axe` y reglas JSX.

### E2E Playwright

- login y cambio obligatorio de contraseña;
- abrir caja, facturar, cobrar, imprimir y reimprimir;
- factura pendiente y cobro posterior;
- anulación permitida y denegada con auditoría;
- cierre sin diferencia y con diferencia;
- filtros, reportes y exportaciones;
- catálogo, fiscalidad, recibos, usuarios y respaldo manual;
- navegación solo por teclado y tamaños representativos;
- recorrido de todos los botones visibles para detectar controles falsos.

### Visuales

- snapshots de cada ruta en 375, 768, 1366 y 1920 px;
- estados claro/oscuro solo si ambos temas quedan oficialmente soportados;
- snapshots de Carta, Media carta y A5;
- comparación visual antes/después archivada en `docs/` o artefactos E2E;
- revisión manual de contraste, foco, truncado, scroll y densidad.

### Gate final

```bash
docker compose up -d
docker compose exec backend php artisan migrate:fresh --seed
docker compose exec backend php artisan test
docker compose exec backend vendor/bin/pint --test
docker compose exec backend vendor/bin/phpstan analyse
docker compose exec frontend npm run typecheck
docker compose exec frontend npm run lint
docker compose exec frontend npm run test
docker compose exec frontend npm run build
docker compose exec frontend npm run e2e
```

Además se verifica instalación desde cero en una máquina o entorno limpio y
acceso desde otro dispositivo de la LAN.

## 13. Documentación e instalación

El rediseño no cambia el objetivo de despliegue. La entrega debe dejar:

- README con arquitectura, requisitos, instalación y diagnóstico;
- `.env.example` completo sin secretos y con cada variable explicada;
- migraciones y seeders reproducibles;
- usuario inicial y obligación de cambiar contraseña;
- comandos de frontend, backend, tests, build y E2E;
- Docker Compose y alternativa manual claramente separadas;
- guía LAN: IP fija/reserva DHCP, firewall, URL de clientes y verificación;
- guía de producción local: HTTPS si corresponde, workers, scheduler, logs,
  respaldos, actualización y rollback;
- runbook para restaurar respaldo mediante un procedimiento técnico controlado;
- mapa de roles, permisos y acciones auditadas;
- guía de impresión basada solo en tipo de papel.

## 14. Exclusiones explícitas

- expediente clínico, citas, farmacia, inventario o historia médica;
- contabilidad de partida doble sin modelo de dominio aprobado;
- egresos ficticios o capturados sin transacción y auditoría;
- restauración/borrado de respaldos desde UI sin backend seguro;
- QR, códigos de barras o IDs internos en recibo institucional principal;
- fuentes, iconos, telemetría, autenticación o servicios cloud obligatorios;
- botones demostrativos, datos de muestra en producción, placeholders o TODOs;
- animación ornamental que retrase o distraiga de una operación.

## 15. Definición de terminado del rediseño total

No se declarará terminado hasta que:

- todas las rutas de `appNavigation.ts` y los estados de autenticación utilicen
  el nuevo shell y design system;
- no queden componentes visuales legacy en rutas de producción;
- Facturación permita paciente → servicios → cobro → recibo de punta a punta;
- Caja muestre apertura, movimientos, métodos, esperado, contado, diferencia y
  cierre auditado;
- contabilidad y reportes cuadren con las fuentes del backend y exporten el mismo
  alcance filtrado;
- recibos Carta, Media carta y A5 funcionen sin controles técnicos;
- historial permita acciones reales y seguras según permisos;
- catálogo, fiscalidad, usuarios, respaldos, ayuda y soporte estén completos;
- ninguna acción visible sea falsa, vacía o no autorizada;
- 320–1920 px, teclado, lector, zoom y reduced-motion estén verificados;
- no existan errores críticos, cadenas corruptas ni pantallas rotas;
- instalación limpia, migraciones, seeders, usuario inicial y LAN estén
  documentados y comprobados;
- lint, typecheck, tests, build y E2E pasen con evidencia fresca;
- el código final esté dividido por dominio, sin dos sistemas visuales ni deuda
  temporal del rediseño.

Este documento sustituye específicamente el enfoque conservador de
“performance/UX closure”. Los planes funcionales previos solo siguen vigentes en
la medida en que sus contratos de negocio no contradigan esta especificación.
