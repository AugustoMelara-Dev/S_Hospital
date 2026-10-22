# Auditoría y propuesta de entrega para una computadora

> Diagnóstico histórico, anterior a la implementación. El rediseño, instalador/actualizador 2026.09.28.2, pruebas actuales y límites de puesta en servicio están en [ENTREGA_ACTUAL_20260928.md](ENTREGA_ACTUAL_20260928.md).

Fecha: 28 de septiembre de 2026. Estado: diagnóstico; cambios de producto pendientes.

## Conclusión

El catálogo real existe y permite administrar productos y servicios, categorías, tarifas y disponibilidad. La operación principal tiene evidencia previa de funcionamiento. Sin embargo, el sistema todavía no acredita el objetivo de instalar todo en una computadora Windows, reiniciar y operar sin asistencia técnica. Hay defectos concretos en reglas heredadas del catálogo, recuperación del administrador, restauración y arranque.

Esta revisión cumple el pedido de analizar antes de modificar. No se cambiaron componentes, reglas, impuestos, precios ni datos comerciales. Se inspeccionó código y se recorrieron pantallas actuales con backend local. Las propuestas siguientes no deben confundirse con funciones ya entregadas.

## Alcance de la revisión y evidencia

- Destino propuesto: una computadora Windows, sin internet durante la operación. Versión de Windows y modelo de impresora pendientes de confirmar.
- UI revisada en navegador independiente a 1366 × 768, sin cabecera de laboratorio: Cobrar vacío, concepto agregado, cantidad, borrador, catálogo, formularios de alta/edición sin guardar, Ayuda, papel y respaldos.
- Resultado actual: valoración del servidor respondió correctamente, cantidad 1 → 2 actualizó total, vista previa no creó factura ni recibo; conteo de facturas visible a esa sesión 0 antes y después. Sin errores de API/consola/página registrados ni mutaciones comerciales en este recorrido.
- Evidencia: [registro actual](evidencia/AUDITORIA-ENTREGA-20260928/auditoria-ui.json), [catálogo cargado y formularios](evidencia/AUDITORIA-ENTREGA-20260928/auditoria-catalogo-focal.json) y [capturas directas](evidencia/AUDITORIA-ENTREGA-20260928/). La captura inicial del listado se repitió esperando las filas reales; la definitiva muestra 122 conceptos del entorno local y 15 filas en la primera página. Las tarifas de ese entorno no son una autorización de precios para el hospital.
- Se conserva como evidencia anterior la campaña [AZUL-BLANCO-20260928](evidencia/AZUL-BLANCO-20260928/), con sus pruebas de cobro, doble envío, cantidades superiores a mil, gratuidad por línea y documentos descargados. No se ejecutó nuevamente toda esa campaña durante esta auditoría. Los archivos de `frontend/src/features/cobrar/` coinciden con su manifiesto de entrega.
- El ensayo anterior de restauración fue **asistido**: [registro](evidencia/AZUL-BLANCO-20260928/backup-restore-real/README.md). No demuestra recuperación automática lista para el hospital.
- No se probó una instalación limpia, un reinicio real de Windows, una impresora física ni recuperación de contraseñas en este recorrido. Tampoco se acredita funcionamiento de todas las secciones por el hecho de que sus páginas abran.

## Decisiones por sección

| Sección | Conservar | Quitar o simplificar | Agregar o mejorar | Criterio de aceptación |
| --- | --- | --- | --- | --- |
| Acceso | Usuarios, permisos, cambio obligatorio inicial y cierre de sesión | Mensajes internos y pasos que requieren consola | Recuperación por otro administrador y procedimiento protegido para administrador único; errores comprensibles | Recuperar acceso sin internet; invalidar accesos anteriores; no habilitar un acceso público sin autorización |
| Navegación y Resumen | Azul/blanco, estructura estable, cifras del servidor | Etiquetas repetidas y avisos técnicos sin acción útil | Priorizar estado de caja, tareas pendientes y problemas que requieren intervención; ayuda accesible según rol | Enlaces correctos, permisos respetados; vacío, pendiente, error y cero diferenciados |
| Cobrar | Cuenta continua, tabla, búsqueda real, nombre del paciente, valoración del servidor | Marcos y controles discordantes; lenguaje técnico en vista previa | Unificar filas, cantidad, búsqueda y total; errores recuperables; foco y teclado predecibles | Agregar/quitar/editar sin cambio de identidad; nueva cuenta sin paciente ni receta heredados; doble envío no duplica |
| Recibos | Histórico, detalle, PDF, reimpresión y auditoría | Configuración de papel como tarea del cajero; información interna en documento | Un comprobante institucional legible, impresión predeterminada y reintento separado del cobro | Reimprimir el mismo documento; error de impresión no crea otro cobro; documentos largos completos |
| Caja | Apertura, movimientos, arqueo, cierre e histórico | Texto técnico y confirmaciones redundantes | Acciones claras, errores de cierre explicados y recuperación tras reinicio | Abrir/cobrar/cerrar; conciliar cifras; cero real válido; no perder operaciones confirmadas |
| Reportes | Filtros reales y exportaciones PDF/Excel | Decoración o explicaciones que no ayudan a interpretar cifras | Consistencia de filtros, totales, estados vacíos y documentos ejecutivos | Descargar desde botones; abrir documentos; concordancia con operaciones y permisos |
| Catálogo | Productos/servicios, categorías, precio, búsqueda y disponibilidad | Precio EPO fijo heredado y restricciones fiscales sin fuente autorizada; rótulos que sugieren solo servicios | Historial de cambios; impacto antes de desactivar categorías; permisos coherentes; enlaces directos fiables | Crear/editar/desactivar concepto sintético; reflejarlo en Cobrar; mantener recibos históricos intactos |
| Usuarios y Administración | Gestión restringida, motivos y auditoría | Papel y mantenimiento técnico mezclados con tareas cotidianas | Separar administración habitual de instalación/recuperación; dependencias de permisos coherentes | Un rol puede ver lo que tiene permiso de gestionar; usuario común no accede a mantenimiento |
| Ayuda | Guía local por tareas | Explicaciones internas, enlaces no autorizados y promesas de recuperación inexistente | Guías cortas para cobrar, reimprimir, cerrar caja, gestionar catálogo, respaldar y recuperar acceso | Funciona sin internet; enlaces válidos para cada rol; instrucciones coinciden con funciones reales |
| Respaldos | Copia manual, historial, cifrado e integridad | Presentar integridad como prueba de restauración; consola técnica para el operador | Automatismo comprobado, copia externa configurada una vez y asistente local protegido de recuperación | Restaurar realmente en MariaDB aislado; verificar datos y objetos; resistir copia corrupta o USB ausente |
| Instalación y arranque | Persistencia local y controles de salud | Docker Desktop como requisito manual; comandos y ventanas de soporte para uso diario | Instalador completo, servicios Windows, datos separados, apertura de app al iniciar sesión y actualización segura | Instalar en Windows limpio sin internet, reiniciar y operar sin herramientas de desarrollo |

El catálogo de este alcance administra conceptos facturables. No se promete inventario farmacéutico por lotes, vencimientos o existencias: ese módulo no está acreditado por esta revisión.

## Revisión visual: antes y propuesta

Se aplicaron `better-ui` y `emil-design-eng`. No se encontró una segunda implementación antigua montada al agregar productos: la ruta operativa usa `CobrarView`. La sensación de mezcla sí tiene base visual en diferencias de densidad, bordes y controles entre las partes del mismo formulario.

| Before | After — propuesto, aún no implementado | Why |
| --- | --- | --- |
| Al agregar, el mismo concepto sigue como resultado azul con botón + y aparece además en la tabla; el buscador cambia de ancho al aparecer Agregar | Mantener ancho estable y distinguir claramente búsqueda de cuenta; limpiar o colapsar el resultado tras agregar, conservando foco y acceso rápido | Evitar la sensación de dos diseños y agregados repetidos por confusión |
| Tabla con borde propio dentro de la cuenta; cantidad más compacta que búsqueda/acciones | Misma familia de controles y divisores, manteniendo una tabla continua y filas fáciles de leer | Evitar que agregar un concepto parezca abrir otra interfaz |
| Vista previa dice «generado por el servidor», «correlativo» y «portrait» | Explicación breve del borrador y documento legible, sin terminología interna | El operador necesita saber si ya cobró y qué entregará |
| Recibo con muchos rótulos, mayúsculas y líneas apretadas | Jerarquía sencilla: institución, paciente, conceptos, total, pago y firmas necesarias | Mejorar lectura y uso de una impresora normal |
| Ajustes de papel expone precedencias entre sesión, usuario y configuración global | Un formato institucional preparado durante instalación; ajustes avanzados restringidos | Evitar decisiones de impresión en cada atención |
| Ayuda mezcla tareas operativas con configuración y mantenimiento | Guía por tarea y permiso, con acciones concretas | Reducir consultas al responsable técnico |

Referencias visuales: [cuenta con producto](evidencia/AUDITORIA-ENTREGA-20260928/02-cobrar-glucosa-agregada-1366x768.png), [vista previa](evidencia/AUDITORIA-ENTREGA-20260928/04-cobrar-vista-previa-borrador-1366x768.png), [ajustes actuales](evidencia/AUDITORIA-ENTREGA-20260928/09-ajustes-papel-1366x768.png).

El [informe focal de QA](evidencia/AUDITORIA-ENTREGA-20260928/AUDITORIA.md) documenta la comparación. La captura 01 corresponde al vacío inicial con consultas en curso; no se usa como prueba de un estado vacío ya asentado. Las capturas 02/03 sí muestran la cuenta valorada.

## Bloqueos de entrega y evidencia de código

### 1. Reglas heredadas del catálogo

`backend/app/Http/Requests/Catalog/StoreServiceRequest.php` y `UpdateServiceRequest.php` imponen precio EPO de 2500 centavos. `frontend/src/features/catalog/components/ServiceDrawer.tsx` bloquea el precio del concepto protegido. Esto contradice el mandato vigente: L.25 es antecedente, no tarifa obligatoria.

También existe tratamiento `taxable=false` forzado. La gratuidad del medicamento y la exención fiscal son decisiones distintas (`MANDATO_DEV.md`, apartado de gratuidad; `MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md`). Resolver contra catálogo/configuración autorizada, sin inventar tasas ni modificar masivamente precios o impuestos existentes. Mantener gratuidad exclusivamente en la línea elegible.

La desactivación de categoría puede ocultar todos sus conceptos sin presentar su impacto. Hay auditoría/historial interno de precios, pero falta una consulta útil por producto o servicio. Los permisos de gestión y visualización pueden asignarse de forma inconsistente. Referencias: `ServiceController.php`, `CategoryController.php`, `ServicePolicy.php`, `RoleController.php`, `CatalogView.tsx`, `CategoryDrawer.tsx` y `navigation/adminNavigation.ts`.

### 2. Administrador único sin recuperación soportada

`backend/app/Policies/UserPolicy.php` impide resetearse a sí mismo. La inicialización en `backend/routes/console.php` solo crea administrador cuando no hay uno activo. Otro administrador sí puede restablecer acceso, pero el caso de una sola cuenta olvidada queda sin solución soportada.

Propuesta: recuperación local protegida mediante autorización del administrador de Windows y/o clave de recuperación bajo custodia institucional. Debe requerir identidad destino y motivo, forzar nueva contraseña, revocar sesiones/tokens y auditar sin guardar secretos. Estar en localhost no basta como autorización. No añadir una puerta pública para cambiar contraseñas sin verificar al solicitante.

### 3. Respaldo generado no equivale a restauración acreditada

`backend/app/Actions/Backups/DatabaseDumpWriter.php` conserva objetos con cláusulas `DEFINER`; el procedimiento de restauración los importa directamente. La prueba real anterior requirió intervención. `VerifyBackupAction.php` comprueba archivo, integridad y descifrado; no acredita por sí sola restaurar una base MariaDB operativa.

Se necesita exportación portable, restauración aislada verificable, chequeo de tablas/relaciones/triggers y una lectura/escritura posterior. El procedimiento existente `scripts/restore_hospital_windows.ps1` sigue siendo técnico y contiene pasos destructivos: no ejecutarlo sobre datos reales durante desarrollo.

La copia externa está desactivada por defecto; una carpeta en el mismo disco no protege frente a pérdida del equipo. Configurar una unidad externa durante instalación y señalar claramente cuando no está disponible. `scripts/install_backup_tasks_windows.ps1` elimina tareas antiguas antes de asegurar las nuevas: la actualización del automatismo debe preservar o recuperar la configuración anterior si falla.

### 4. Instalador y arranque incompletos para el objetivo solicitado

`installer/S_Hospital.iss` requiere Docker Desktop. `scripts/install_hospital_autostart.ps1` registra inicio por usuario y `scripts/start_hospital_windows.ps1` inicia/verifica componentes, pero no abre la aplicación. No hay un instalador candidato actual ni certificación Windows limpia aprobada: `qa/pre-installation-final/windows-clean/RESULT.json` está pendiente.

Propuesta técnica: paquete Windows con MariaDB, PHP y servidor web de producción, procesos de trabajo y programador necesarios, registrados como servicios. MariaDB soporta instalación como servicio y directorio de datos configurable en su [instalador oficial para Windows](https://mariadb.com/docs/server/server-management/install-and-upgrade-mariadb/installing-mariadb/binary-packages/installing-mariadb-msi-packages-on-windows). La selección y empaquetado del resto del runtime requieren una prueba de viabilidad y versiones compatibles; no se da esa migración por resuelta.

Separar programa versionado de datos/configuración/respaldos. Arrancar servicios con Windows; abrir la aplicación al iniciar sesión en Windows, cuando el servicio esté listo. Conservar autenticación de la aplicación. La cuenta local por defecto no debe exponer servicios a la red innecesariamente.

Actualizar con copia preventiva comprobada, control de escrituras, nueva versión separada y verificación antes del cambio. No prometer reversión automática de cualquier migración de datos: definir compatibilidad y recuperación explícitas por versión. Conservar datos al reparar o desinstalar salvo acción separada, expresa y protegida.

## Impresión propuesta

Preparar una hoja carta con ejemplar del paciente y ejemplar de archivo, separados por línea de corte, cuando la cantidad de conceptos permita lectura cómoda. Esa estructura ya existe parcialmente; falta simplificar y validar el resultado físico. Cargar hojas completas en una impresora normal y cortar después de imprimir evita exigir alimentación de media hoja.

Para cuentas extensas, paginar y conservar detalle/totales sin reducir letra hasta hacerla ilegible. Si el hospital no requiere archivo en papel, definir una sola copia durante instalación. No obligar a decidir tamaño, márgenes o copias en cada cobro. La configuración inicial del controlador y la impresora predeterminada se realiza una vez y se prueba con el equipo real.

En un navegador ordinario no se promete impresión silenciosa. El flujo debe abrir la impresión del recibo ya registrado con valores preparados y permitir repetirla si falla. El contador de entrega lógica del PDF no prueba que salió una hoja: `InstitutionalReceiptPdfService.php` ya distingue ambos hechos. No volver a emitir ni cobrar por un problema de impresora.

## Orden de ejecución y aceptación

1. **Reglas y acceso recuperable.** Quitar restricciones heredadas del catálogo mediante configuración autorizada; preservar snapshots históricos; implementar recuperación protegida. Pruebas focales de permisos, cambio de tarifa, gratuidad mixta, revocación y administrador único.
2. **Respaldo y recuperación.** Exportación portable y restauración aislada sobre MariaDB; automatismo seguro; copia externa y estados honestos. Probar corrupción, falta de espacio, destino ausente, reinicio y fallo a mitad de recuperación. No usar datos productivos.
3. **Consistencia y administración cotidiana.** Unificar Cobrar/recibos/formularios; catálogo completo con historial e impacto; ayuda por rol; retirar papel del flujo diario. Autor y revisor visual cargan ambos skills. Revisar en escritorio, teclado y capturas directas; comprobante renderizado e impreso.
4. **Paquete de una computadora.** Primero demostrar runtime nativo completo y respaldos sin Docker en entorno aislado. Luego construir instalador, servicios, launcher, reparación y actualización. Probar Windows limpio con internet desconectado y sin runtimes previamente instalados.
5. **Aceptación integrada.** Instalar → reiniciar → acceder → recuperar contraseña de prueba → administrar concepto sintético → abrir caja → cobrar → imprimir/reimprimir → reportar PDF/Excel → respaldar → restaurar en entorno desechable → verificar → cerrar caja. Probar doble envío, fallo de impresión, servidor temporalmente detenido, gratuidad por línea y cantidades mayores de mil. Guardar documentos descargados desde sus botones y evidencia actual.

Responsabilidad: un propietario por archivo. Frentes de UI, catálogo/permisos y plataforma pueden avanzar en tareas independientes; migraciones, pruebas que mutan datos, compilaciones y certificaciones pesadas se serializan. Antes de editar, asignar los archivos concretos. No reutilizar una aprobación de una fase como prueba de otra.

Condición de entrega: ningún bloqueo crítico abierto; recorrido completo acreditado en el paquete que se instalará; respaldo restaurado realmente; impresión física probada; instrucciones locales breves para operación y recuperación. El estado actual todavía no cumple esa condición.
