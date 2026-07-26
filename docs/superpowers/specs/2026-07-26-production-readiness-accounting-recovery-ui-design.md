# S_Hospital: integridad financiera, recuperación y cierre operativo

Fecha: 2026-07-26  
Estado: diseño aprobado para planificación  
Objetivo operativo: una sola PC principal, preparada para habilitar clientes LAN sin cambiar la fuente de datos.

## 1. Problema y criterio de éxito

S_Hospital debe quedar listo para instalarse y operar localmente sin internet. El cierre abarca cinco riesgos relacionados:

1. Una receta de diálisis debe volver gratuita únicamente la eritropoyetina institucional de L 25.00. No debe descontar ningún otro producto o servicio de la factura.
2. Los totales, pagos, caja, reportes y catálogos deben conservar una sola interpretación contable verificable.
3. Los respaldos deben ejecutarse automáticamente y el hospital debe disponer de una restauración local guiada y comprobable.
4. La instalación en una sola PC debe concluir con el sistema funcionando, respaldos activos y un acceso directo reconocible.
5. Todos los módulos deben conservar usabilidad responsive y accesibilidad en el estado final.

Se considerará exitoso cuando los contratos de negocio estén protegidos por pruebas automatizadas, el instalador y la recuperación hayan sido ensayados en condiciones locales, y la matriz de UI no presente defectos críticos o serios pendientes.

## 2. Hallazgos de línea base

La auditoría inicial encontró que el cálculo vigente del backend aplica L 0 solamente a líneas cuyo `special_rule_code` es `ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION`. Las pruebas dirigidas actuales aprobaron 58 casos backend y 46 casos frontend, incluidos cestas mixtas y reglas de diálisis.

Sin embargo, persisten riesgos que explican o permiten incidentes de campo:

- el catálogo acepta que un usuario asigne la regla especial al crear otro servicio;
- un paquete offline desactualizado puede contener lógica anterior aunque `main` esté corregido;
- la evidencia de cálculo no cubre por sí sola toda la cadena de pago, caja, recibo y reporte para una cesta mixta de alto valor;
- la restauración actual está diseñada para una base descartable de validación, no como recuperación productiva guiada;
- el instalador contiene un creador de acceso directo, pero el flujo principal no lo ejecuta al finalizar;
- las certificaciones responsive y de accesibilidad preceden a los cambios que resulten de este cierre y deben repetirse.

## 3. Decisiones de diseño

### 3.1 Endurecimiento incremental

Se conservará la arquitectura React, Laravel y MySQL/MariaDB existente. No se reescribirán módulos estables. Cada cambio será pequeño, con pruebas y un commit Conventional Commit independiente por fase.

### 3.2 Backend como fuente de verdad financiera

El backend seguirá calculando y almacenando precios, subtotal, ISV, total, saldo y estado. El frontend podrá mostrar una estimación, pero la confirmación y los documentos usarán la respuesta persistida del backend.

El dinero continuará representándose en centavos enteros durante cálculos y comparaciones. Las facturas históricas conservarán snapshots y nunca se recalcularán desde el catálogo actual.

### 3.3 Regla especial institucional protegida

La receta de diálisis será una condición de la factura que solo afecta servicios institucionales identificados explícitamente como eritropoyetina.

El catálogo ordinario no permitirá asignar ni retirar manualmente `ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION`. La regla se administrará como dato institucional protegido por seeder/migración o por una acción administrativa específica, no como una opción general del formulario.

La integridad se comprobará en tres niveles:

- validación de solicitudes de catálogo;
- auditoría/diagnóstico de registros existentes con la regla;
- cálculo línea por línea en facturación.

Una factura con producto L 900.00 y eritropoyetina L 25.00 con receta debe producir producto L 900.00, eritropoyetina L 0.00 y total L 900.00 más el ISV que corresponda únicamente a líneas gravables.

### 3.4 Restauración fuera del proceso web activo

La restauración productiva no será un endpoint HTTP que sustituya la base mientras la aplicación atiende solicitudes. La pantalla de respaldos explicará y lanzará, cuando el entorno lo permita, un asistente local de mantenimiento con privilegios explícitos.

El asistente deberá:

1. exigir un archivo admitido y su checksum;
2. verificar que la clave local puede descifrarlo;
3. crear y validar una restauración temporal;
4. comprobar tablas y conteos críticos;
5. crear un respaldo preventivo de la base activa;
6. cerrar caja operativa o bloquear si existen sesiones abiertas;
7. activar modo mantenimiento y detener procesos que escriben;
8. restaurar la base activa;
9. ejecutar migraciones compatibles y comprobaciones de salud;
10. reanudar servicios solo si todas las verificaciones pasan;
11. conservar bitácora, checksum y resultado;
12. ofrecer rollback al respaldo preventivo si falla después de modificar producción.

El flujo Docker y el flujo Windows bare-metal compartirán el mismo contrato de seguridad, aunque sus comandos de orquestación sean distintos.

### 3.5 Una PC primero, LAN compatible

El instalador presentará “Esta computadora” como ruta recomendada y usará `127.0.0.1` para el acceso local. La configuración LAN será una opción adicional, no una condición para terminar la instalación.

Al finalizar deberá:

- confirmar servicios, migraciones, admin y rutas de salud;
- confirmar worker/scheduler de respaldos;
- ejecutar un respaldo de prueba o informar claramente por qué no pudo;
- crear un acceso directo con nombre e icono institucional en Escritorio y, cuando sea posible, en Inicio;
- abrir o mostrar la URL local;
- emitir un resumen sin secretos y una ruta de diagnóstico.

Las instalaciones LAN seguirán usando una sola base y una sola instancia del backend.

## 4. Componentes y límites

### 4.1 Integridad financiera y catálogo

Responsabilidades:

- restringir la asignación de reglas institucionales;
- detectar datos de catálogo incompatibles;
- probar cestas mixtas, impuestos, cantidades y snapshots;
- reconciliar factura, pagos, movimientos de caja, recibos y reportes.

No incluye contabilidad de libro mayor de doble partida. “Contabilidad” en este cierre significa trazabilidad coherente de ingresos, cobros, saldos, caja, anulaciones y reportes con las tablas actuales.

### 4.2 Respaldo y recuperación

Responsabilidades:

- verificar programación diaria y supervisión del worker/scheduler;
- asegurar retención, cifrado, checksum y estado visible;
- implementar el asistente local de restauración;
- realizar un ensayo en base descartable y un ensayo controlado del mecanismo de sustitución/rollback en un entorno aislado.

La clave de cifrado nunca se incluirá en logs, frontend, repositorio ni evidencias compartibles.

### 4.3 Instalador y acceso

Responsabilidades:

- consolidar el flujo canónico en `setup.bat` y `scripts/deploy_hospital_lan.ps1`;
- mantener idempotencia sobre instalaciones existentes;
- crear accesos directos sin sobrescribir destinos ajenos;
- verificar respaldos y salud antes de declarar éxito;
- mantener sincronizado `offline-release`.

### 4.4 UI, responsive y accesibilidad

Rutas mínimas:

- login y cambio obligatorio de contraseña;
- inicio;
- nueva factura;
- caja;
- catálogo;
- historial;
- reportes;
- respaldos/recuperación;
- configuración fiscal;
- recibos institucionales;
- usuarios;
- ayuda, soporte, acerca de;
- acceso denegado y ruta inexistente.

Estados mínimos: carga, vacío, error, éxito, diálogos, tablas con datos extensos, cesta mixta, caja abierta/cerrada, respaldo pendiente/exitoso/fallido y restore no disponible/disponible.

Viewports mínimos: 320×640, 390×844, 768×1024, 1024×768, 1366×768 y 1920×1080, más reflow con zoom de 200 %.

## 5. Flujo de datos financiero

1. El catálogo entrega servicios activos y facturables con precio y metadatos.
2. El frontend construye la solicitud con paciente, cantidades y la condición de receta autorizada.
3. `CreateInvoiceAction` bloquea la caja y carga los servicios desde la base.
4. `CalculateInvoiceTotalsAction` evalúa cada línea y aplica L 0 solo cuando coinciden receta y regla institucional.
5. La transacción guarda factura e ítems con snapshots en centavos.
6. El cobro registra pago, caja, cajero, método y fecha.
7. Los recibos y reportes leen hechos persistidos, no precios actuales del catálogo.
8. Anulación o reversa conserva historial y auditoría sin borrar la factura.

La invariante principal será:

`suma(invoice_items.line_total_cents) = invoices.total_cents`

Los ingresos y movimientos de caja solo incluirán pagos contabilizados; una eritropoyetina gratuita tendrá trazabilidad de L 0 sin convertirse en ingreso ni movimiento efectivo.

## 6. Manejo de errores y recuperación

- Una regla especial inválida se rechazará con un mensaje orientado a la acción y auditoría cuando corresponda.
- Una discrepancia de totales abortará toda la transacción.
- Un respaldo sin cifrado, checksum o espacio suficiente fallará sin publicar un archivo confiable.
- Una restauración no modificará producción hasta aprobar la validación temporal.
- Sesiones de caja abiertas, procesos activos o un respaldo preventivo fallido bloquearán el restore.
- Si el restore falla después del reemplazo, el asistente mantendrá el sistema en mantenimiento y ofrecerá rollback controlado; no anunciará disponibilidad.
- El instalador no mostrará “completado” si fallan salud, migraciones o creación del administrador.
- Fallos no críticos, como no poder fijar el acceso en Inicio, se mostrarán como advertencias con una alternativa manual.

## 7. Estrategia de pruebas

### Backend

- Unit tests para cálculo en centavos y regla de eritropoyetina.
- Feature tests para creación de servicios, facturas mixtas, pagos, caja, recibos, reportes y permisos.
- Tests de comandos/acciones de respaldo y restore con dependencias controladas.
- Pruebas MySQL/MariaDB para migraciones, constraints y restauración.

### Frontend

- Tests de formulario de catálogo que no expone la regla institucional.
- Tests de cesta y confirmación que distinguen línea gratuita de líneas cobrables.
- Tests de estados de respaldo/restore e instrucciones accesibles.
- Tests de navegación, foco, mensajes y controles críticos.

### E2E y scripts

- Flujo real: producto L 900 + eritropoyetina con/sin receta, emisión, cobro, impresión, reimpresión y reporte.
- Apertura/cierre de caja y reconciliación.
- Respaldo automático/manual y restore en entorno aislado.
- Self-tests del instalador, diagnóstico, idempotencia y acceso directo.
- Matriz Playwright responsive y axe sobre todas las rutas.

Cada corrección de comportamiento seguirá rojo-verde-refactor. Antes de afirmar cierre se ejecutarán pruebas completas, análisis estático, lint, typecheck y builds aplicables.

## 8. Fases y commits previstos

1. `test(billing): reproduce mixed dialysis basket accounting`
2. `fix(catalog): reserve erythropoietin rule for institutional service`
3. `fix(accounting): reconcile mixed invoices across payments and reports`
4. `feat(backups): add guarded local restore workflow`
5. `fix(installer): complete single-pc setup and application shortcuts`
6. `fix(ui): close responsive and accessibility findings`
7. `test(release): certify offline install backup restore and billing`
8. `docs(release): record production readiness evidence`

Los commits exactos podrán dividirse más si una fase contiene cambios independientes.

## 9. Criterios de aceptación

- La cesta L 900 + eritropoyetina con receta nunca totaliza L 0.
- Sin receta, eritropoyetina conserva L 25.
- Solo el servicio institucional autorizado puede tener la regla especial.
- Facturas históricas no cambian al editar precios.
- Pagos, caja, recibos y reportes concilian con los mismos centavos persistidos.
- El respaldo diario queda instalado, observable y probado.
- Existe recuperación local guiada con validación previa, mantenimiento, respaldo preventivo y rollback.
- Una instalación nueva en una PC termina con acceso por icono y sin internet.
- La misma instalación puede habilitar LAN sin bases separadas.
- No hay defectos critical/serious de accesibilidad ni overflow horizontal en la matriz final.
- Migraciones desde cero, pruebas, análisis y builds definidos para el release pasan con evidencia reciente.

## 10. Fuera de alcance

- servicios cloud o sincronización SaaS;
- expediente clínico completo;
- contabilidad general de doble partida;
- instalación de bases independientes en varias computadoras;
- restauración remota mientras el sistema permanece en operación;
- rediseño visual total sin relación con hallazgos verificables.

