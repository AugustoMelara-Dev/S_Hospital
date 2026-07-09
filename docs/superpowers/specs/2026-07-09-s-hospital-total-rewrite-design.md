# Reescritura total de S_Hospital

Fecha: 2026-07-09
Estado: diseño aprobado para reescritura total
Producto: sistema hospitalario local de caja, facturación, recibos, contabilidad operativa, reportes y administración

## 1. Decisión

S_Hospital se reescribirá de forma integral con React, TypeScript, Laravel y
MariaDB/MySQL. La reescritura reemplazará la experiencia, la estructura del
frontend, los límites de dominio del backend, los flujos operativos y el
proceso de instalación. No se borrarán facturas, pagos, recibos, cierres,
auditorías ni configuraciones históricas válidas.

La entrega será una sola versión instalable. El trabajo interno se dividirá en
fases pequeñas, probadas y commiteables. Cada fase debe conservar una ruta de
migración desde la base existente y dejar el sistema en un estado verificable.

## 2. Objetivos

- Operar sin internet en una computadora servidor y permitir acceso por LAN.
- Completar el ciclo abrir caja, facturar, cobrar, emitir recibo, reimprimir,
  cerrar caja, conciliar y reportar.
- Reducir la carga cognitiva de cajeros, supervisores y administradores.
- Mantener el backend como única fuente de verdad para dinero, impuestos,
  permisos, estados y numeración.
- Evitar pantallas, botones o configuraciones que no tengan una operación real.
- Hacer reproducibles instalación, migración, seed, pruebas, build, respaldo y
  restauración.
- Permitir crecimiento por módulos sin volver a concentrar lógica en pantallas
  o controladores monolíticos.

## 3. Fuera de alcance

- Expediente clínico, diagnósticos, farmacia, inventario, camas, citas y
  laboratorio clínico no forman parte de esta versión.
- No se implementará contabilidad financiera de partida doble, cuentas por
  pagar, nómina ni libro mayor. El producto entregará contabilidad operativa de
  caja e ingresos con exportaciones auditables.
- No se dependerá de servicios cloud, CDNs, autenticación externa ni APIs SaaS.
- No se inventarán CAI, rangos, series ni datos fiscales del hospital.
- No se afirmará que una impresora, una segunda PC o el servidor definitivo
  fueron validados sin evidencia obtenida en ese hardware.

## 4. Riesgos y controles

### Pérdida o reinterpretación de historia

Las facturas conservarán snapshots de nombres, precios, impuestos, datos
fiscales y papel. Los datos históricos no se recalcularán desde el catálogo.
Las migraciones serán aditivas o transformarán datos dentro de transacciones,
con pruebas de compatibilidad y respaldo previo obligatorio.

### Regresiones en caja y dinero

Todo importe se representará en centavos enteros dentro del dominio. Las
operaciones de factura, pago, anulación, reverso, apertura y cierre usarán
transacciones de base de datos, bloqueos y llaves de idempotencia. Las pruebas
de concurrencia cubrirán doble cobro, doble apertura y numeración concurrente.

### Reescritura demasiado extensa

La arquitectura se reemplazará por módulos verticales. Cada módulo tendrá
contrato, pruebas y criterio de aceptación propios. La ruta pública solo se
conmutará al módulo nuevo cuando su flujo sea equivalente o superior al actual.

### Instalación sin conectividad

El paquete final incluirá imágenes, dependencias y activos necesarios para
operar desconectado. El instalador ejecutará preflight, configuración segura,
migraciones, seed base, creación del administrador, arranque y verificación de
salud sin descargar componentes durante la operación normal.

## 5. Arquitectura objetivo

### 5.1 Backend Laravel

El backend se organizará por dominios:

- `Auth`: sesión, cambio de contraseña, bloqueos y recuperación administrativa.
- `Access`: roles, permisos, riesgo de permisos y políticas.
- `Catalog`: categorías, áreas, servicios y precios históricos.
- `Billing`: borrador de solicitud, cálculo, numeración, emisión y anulación.
- `Payments`: cobros, parciales, métodos, reversos e idempotencia.
- `Cash`: apertura, movimientos, conciliación, diferencias y cierre.
- `Receipts`: emisión institucional, snapshots, PDF y eventos de impresión.
- `Reporting`: consultas de solo lectura y exportaciones.
- `Backups`: creación, cifrado, retención, descarga y restauración guiada.
- `Operations`: salud local, scheduler, cola, errores de cliente y auditoría.

Cada comando de negocio será una Action o Service con entrada explícita y
resultado tipado. Los controladores validarán mediante Form Requests,
autorizarán mediante Policies/Gates y delegarán el trabajo. Ningún controlador
calculará dinero ni decidirá permisos manualmente.

Los eventos de auditoría se escribirán dentro de la misma transacción del hecho
auditado cuando el evento sea parte de la integridad del negocio. Las
notificaciones de tiempo real se publicarán después del commit.

### 5.2 API

La API usará rutas por recurso y acciones explícitas. Las mutaciones críticas
aceptarán `Idempotency-Key`. Los errores tendrán código estable, mensaje seguro
para el usuario y errores por campo. No se enviarán rutas internas, comandos,
stack traces, secretos ni nombres físicos de respaldo al navegador.

Los contratos se documentarán en OpenAPI y se probarán desde backend y
frontend. Los cambios incompatibles se introducirán bajo `/api/v2` mientras se
migra el consumidor. Al finalizar la reescritura, las rutas v1 sin consumidores
se retirarán con una prueba que impida referencias residuales.

### 5.3 Frontend React

El frontend se organizará por módulos verticales. Cada módulo contendrá rutas,
pantallas, componentes, esquema Zod, consultas, mutaciones y pruebas. Los
componentes compartidos se limitarán a controles visuales y patrones de
interacción verdaderamente reutilizables.

Estructura objetivo:

```text
frontend/src/
  app/
    router/
    session/
    query/
    shell/
  modules/
    dashboard/
    billing/
    invoices/
    cash/
    accounting/
    reports/
    catalog/
    receipts/
    fiscal/
    users/
    backups/
    support/
  shared/
    api/
    forms/
    tables/
    feedback/
    format/
    accessibility/
  styles/
```

Las pantallas coordinarán casos de uso; no contendrán clientes HTTP, reglas
fiscales ni cálculos monetarios. TanStack Query manejará estado de servidor.
React Hook Form y Zod manejarán formularios. Los estados efímeros complejos se
resolverán con reducers locales, sin introducir un store global innecesario.

### 5.4 Base de datos

Se preservarán las tablas y claves históricas. Las tablas monetarias tendrán
columnas enteras en centavos como fuente canónica. Las columnas decimales
existentes solo se conservarán durante la migración si son necesarias para
compatibilidad.

Índices obligatorios cubrirán fecha, número, paciente, estado, caja, usuario,
categoría, serie fiscal y llaves de idempotencia. Las facturas y sus items no
admitirán borrado. Los cierres quedarán inmutables; cualquier corrección
posterior será un evento compensatorio autorizado y auditado.

## 6. Diseño de producto y navegación

La navegación se adaptará al rol y usará lenguaje operacional:

- Inicio
- Nueva factura
- Caja
- Facturas
- Reportes
- Catálogo
- Administración
- Ayuda

Administración agrupará hospital, fiscal, recibos, usuarios, permisos,
respaldos y estado del sistema. Un cajero no verá módulos administrativos ni
paneles bloqueados. Un usuario sin permiso recibirá una página clara si abre
una URL protegida, pero la navegación normal no ofrecerá la acción.

El shell tendrá enlace para saltar al contenido, foco visible, navegación por
teclado, estado de conexión LAN y estado de caja. No mostrará diagnósticos
técnicos, reloj decorativo ni duplicación de identidad.

## 7. Flujos funcionales

### 7.1 Facturación

1. Verificar caja abierta y configuración fiscal válida.
2. Registrar el nombre obligatorio del paciente.
3. Buscar servicios por nombre, categoría o área.
4. Agregar cantidades y marcar receta de diálisis cuando aplique.
5. Solicitar al backend una previsualización de totales.
6. Confirmar paciente, servicios, impuestos y total.
7. Emitir la factura con idempotencia.
8. Cobrar total o parcialmente.
9. Emitir el recibo institucional después del pago correspondiente.
10. Ofrecer impresión explícita y nueva factura.

Eritropoyetina tendrá precio L.25.00, no será gravada y será gratuita cuando
se marque receta de diálisis. El backend aplicará y auditará la regla.

### 7.2 Pagos

Los métodos serán efectivo, tarjeta, transferencia y otro. Las referencias
serán obligatorias según el método configurado. Todo pago se asociará a
factura, caja, cajero y fecha. Un reverso exigirá permiso, motivo y auditoría;
no eliminará el pago original.

Si el pago se registra pero la emisión del recibo falla, la interfaz mostrará
que el cobro fue exitoso y ofrecerá recuperar el recibo desde Facturas. Nunca
invitará a repetir el cobro.

### 7.3 Recibos e impresión

El usuario solo podrá seleccionar:

- Carta
- Media carta
- A5

El sistema resolverá orientación, márgenes, tipografía, escala, saltos de
página y tamaño. Los perfiles serán internos, versionados y probados. La
interfaz no expondrá medidas, fuentes, márgenes ni controles de escala, incluso
a administradores. Los formatos 80 mm y 58 mm permanecerán únicamente como
compatibilidad de soporte, fuera del flujo principal.

No habrá autoimpresión. Imprimir, descargar, reimprimir y anular recibos serán
acciones explícitas. Primera impresión y reimpresión generarán eventos
auditables. Una reimpresión exigirá motivo cuando la política lo determine.

El documento principal no mostrará QR, código de barras ni códigos internos.
Incluirá hospital, paciente, número, fecha, detalle, impuestos, total, pagos,
cajero y espacio institucional de firma/sello.

### 7.4 Caja y contabilidad operativa

Solo habrá una caja local abierta por gaveta/instalación según la configuración
operativa. Apertura y cierre serán idempotentes. La vista de caja mostrará:

- fondo inicial;
- cobros por método;
- efectivo esperado;
- efectivo contado;
- diferencia viva;
- facturas pendientes o parciales;
- recibos institucionales pendientes;
- anulaciones y reversos;
- responsable de apertura y cierre.

No se podrá cerrar con facturas pendientes de esa sesión ni recibos pagados sin
emitir. Una diferencia requerirá motivo. El cierre guardará snapshots de
totales y métodos.

El sistema no permitirá registrar egresos genéricos en esta versión porque no
existe una política contable definida para ellos. Los reportes indicarán
claramente que los egresos operativos no están modelados, en vez de presentar
un valor engañoso. La arquitectura reservará movimientos compensatorios
autorizados para una futura política aprobada.

### 7.5 Facturas e historial

La lista permitirá buscar por número, paciente, fecha, estado y caja. Cada fila
mostrará únicamente acciones válidas para su estado y permiso: ver, cobrar,
generar recibo pendiente, imprimir, reimprimir, anular o reversar. No existirán
botones que conduzcan previsiblemente a 403 o a una operación inexistente.

### 7.6 Reportes

Reportes tendrá tres espacios:

- Ejecutivo: facturado, cobrado, pendiente, anulaciones, ticket promedio,
  tendencia, métodos y servicios.
- Caja: sesiones, apertura, cobros, esperado, contado, diferencia y responsable.
- Auditoría: anulaciones, reversos, reimpresiones, cambios fiscales, usuarios,
  permisos y respaldos.

Todos los indicadores usarán una definición visible y el mismo criterio en UI,
PDF y Excel. Los filtros tendrán zona horaria America/Tegucigalpa. Las
exportaciones neutralizarán fórmulas en celdas y se autorizarán en backend.

### 7.7 Catálogo

El catálogo separará datos básicos, precio, impuestos y regla especial. Los
cambios de precio exigirán motivo y generarán historia. Desactivar sustituirá
el borrado cuando un servicio tenga referencias históricas.

### 7.8 Fiscal

La configuración fiscal separará identidad del hospital, impuestos y
secuencias. La activación o reinicio de rangos requerirá permiso de alto riesgo,
motivo y confirmación. Los rangos agotados o vencidos bloquearán emisión, no
consulta ni reportes.

### 7.9 Usuarios y permisos

Los roles base serán administrador, supervisor, cajero y auditor. Los permisos
se mostrarán con etiquetas humanas y nivel de riesgo. Los slugs permanecerán
internos. Crear usuario exigirá contraseña temporal robusta y cambio al primer
ingreso. No se podrá desactivar al último administrador activo ni autoelevar
privilegios sin autorización.

### 7.10 Respaldos

El panel mostrará último respaldo válido, próxima ejecución, estado del worker,
retención y acciones permitidas. El operador no verá rutas, hashes, comandos o
nombres físicos. Crear, descargar y restaurar se auditarán. La restauración se
ejecutará mediante procedimiento técnico con verificación de integridad y base
destino explícita; nunca sobrescribirá silenciosamente producción.

### 7.11 Dashboard

Inicio mostrará la siguiente acción prioritaria, estado de caja, resumen del
día y alertas accionables. No renderizará grandes espacios de “sin permiso”.
Los datos administrativos solo aparecerán para roles autorizados.

## 8. Sistema visual y accesibilidad

La interfaz usará una paleta sobria de neutros fríos con verde hospitalario
como acento operacional. Rojo y ámbar se reservarán para riesgo y advertencia.
La tipografía se servirá localmente y los valores financieros usarán números
tabulares.

Se aplicará una escala de espaciado, radios y elevación pequeña. Las tablas
serán densas pero legibles; los formularios usarán secciones y divulgación
progresiva. Los diálogos se reservarán para confirmaciones o tareas breves.

Requisitos de accesibilidad:

- WCAG 2.2 AA como objetivo verificable;
- contraste suficiente en todos los estados;
- foco siempre visible;
- flujo completo por teclado;
- nombres accesibles para iconos y controles;
- errores asociados al campo y resumen al enviar;
- regiones de estado para operaciones asíncronas;
- objetivos táctiles de al menos 44 por 44 CSS px cuando sea aplicable;
- respeto a `prefers-reduced-motion`;
- una sola jerarquía de encabezados y landmarks por pantalla.

## 9. Seguridad

- Laravel Sanctum con sesión HttpOnly y protección CSRF.
- Cookies cifradas y `SameSite=Lax`; `Secure` configurable solo cuando exista
  HTTPS real.
- CSP, `frame-ancestors`, `nosniff`, Referrer-Policy y Permissions-Policy.
- CORS limitado a los orígenes LAN configurados.
- Rate limiting por usuario e IP en autenticación y mutaciones sensibles.
- Mensajes sin stack traces ni datos internos en producción.
- Validación y autorización exclusivamente confiables en backend.
- Auditoría inmutable de acciones de alto impacto.
- Descargas protegidas contra path traversal e inyección de fórmulas.
- Lockfiles y builds reproducibles; auditoría de dependencias en CI/release.
- Secretos solo en variables de servidor y nunca en `VITE_*`.

## 10. Instalación y operación LAN

El repositorio tendrá dos caminos documentados:

1. Desarrollo con Docker Compose.
2. Paquete offline de producción para Windows/Linux técnico.

El instalador realizará:

1. comprobación de CPU, RAM, disco, puertos, Docker y permisos;
2. generación segura de APP_KEY, claves de respaldo y credenciales de base;
3. carga de imágenes offline;
4. arranque de MariaDB, backend, nginx, queue, scheduler y websocket local;
5. migraciones con respaldo previo;
6. seed de roles, permisos, catálogo y perfiles de papel;
7. creación interactiva del primer administrador sin contraseña por defecto;
8. prueba de salud, cola, scheduler, base y almacenamiento;
9. muestra de URL local y URL LAN;
10. creación de acceso directo y registro de instalación sin secretos.

README explicará variables, comandos, migraciones, seeders, usuario inicial,
desarrollo, pruebas, build, actualización, backup, restore, LAN y solución de
problemas. `.env.example` distinguirá valores requeridos, opcionales y
generados.

## 11. Estrategia de migración de la reescritura

1. Congelar contratos y hechos históricos mediante pruebas de caracterización.
2. Crear módulos v2 y adaptadores de lectura sobre el esquema actual.
3. Migrar dinero y snapshots pendientes sin eliminar columnas antiguas.
4. Reemplazar rutas frontend módulo por módulo detrás del router nuevo.
5. Introducir endpoints v2 únicamente donde el contrato existente impida el
   diseño objetivo.
6. Ejecutar pruebas de equivalencia sobre una copia anonimizada o seed dorado.
7. Retirar código v1 solo cuando no tenga rutas, imports ni consumidores.
8. Ejecutar instalación desde cero y actualización desde una base v1.
9. Generar el paquete offline desde un commit limpio y firmado.

## 12. Estrategia de pruebas

### Backend

- Unit tests para dinero, impuestos, numeración, eritropoyetina y conciliación.
- Feature tests para todos los endpoints y permisos.
- Tests de integración MariaDB para constraints, bloqueos y migraciones.
- Tests de concurrencia para numeración, pago, caja e idempotencia.
- Roundtrip de respaldo y restauración en una base descartable.

### Frontend

- Tests de componentes para formularios, tablas, estados y accesibilidad.
- Tests de integración por módulo con contratos API controlados.
- Guards arquitectónicos para límites de tamaño, imports y rutas retiradas.
- Axe en login, shell y flujos críticos.

### E2E

- Primer inicio y cambio de contraseña.
- Apertura de caja.
- Factura normal y factura con eritropoyetina/receta.
- Pago total y parcial.
- Emisión e impresión explícita de Carta, Media carta y A5.
- Recuperación de recibo después de fallo posterior al pago.
- Reimpresión con auditoría.
- Anulación y reverso con motivo.
- Cierre sin y con diferencia.
- Reportes y exportaciones.
- Usuarios, permisos y respaldo manual.

## 13. Criterios de aceptación

La entrega solo será candidata a uso cuando:

- una instalación limpia completa migraciones y seed sin intervención manual
  no documentada;
- una actualización desde la versión existente preserva todos los hechos;
- facturación, pagos, recibos, caja, historial y reportes funcionan de punta a
  punta;
- el usuario solo selecciona papel al imprimir;
- no existe autoimpresión ni repetición ambigua de cobro;
- permisos de frontend y backend están alineados;
- no existen botones falsos, rutas rotas, placeholders de producto ni TODOs;
- lint, typecheck, pruebas, análisis estático y build pasan;
- los E2E críticos pasan contra MariaDB;
- la documentación reproduce la instalación y la operación LAN;
- el reporte de seguridad no contiene hallazgos críticos o altos sin resolver;
- el repositorio y el paquete offline pasan el guard de release limpio.

Las validaciones dependientes de hardware se entregarán con checklist y espacio
de evidencia. Sin esa evidencia, el software podrá declararse candidato
técnico, pero no “validado físicamente” para ese hospital específico.
