# S_Hospital — R2: refactor correctivo e integración real

## 1. Orden de ejecución y autoridad

Continúa con `hs-orchestrator` y el DeepSeek V4.1 Flash ya seleccionado, sobre el worktree actual de S_Hospital. Este encargo es IMPLEMENTACIÓN, no otra auditoría general. El usuario ha rechazado el resultado funcional y visual y autoriza refactorizar módulos, estado, componentes, estilos, configuración y generadores de exportación. No reducirlo a tokens, renombrar archivos o añadir otra capa encima del código anterior.

Las restricciones estéticas/técnicas heredadas que exijan conservar el layout actual, no tocar el reducer, no tocar el cálculo de preview o mantener indefinidamente adaptadores obsoletos quedan superadas por esta autorización cuando impidan reparar. Consolida la instrucción vigente y marca los antecedentes como históricos, sin destruir evidencia. Los tests que codifiquen un comportamiento incorrecto también deben corregirse con justificación y nuevas regresiones. Ningún comentario antiguo convierte un bug en política del hospital.

Esto NO autoriza borrar datos, perder trazabilidad, relajar permisos, eliminar idempotencia/constraints, inventar impuestos o reglas clínicas, restaurar producción, gastar dinero, hacer push ni resetear WSL/Docker. Tampoco autoriza sobrescribir el trabajo C1 con la versión remota de agosto.

Arranca leyendo `ESTADO.md#CHECKPOINT C1` y las evidencias C1 guardadas. Verifica el manifiesto existente y crea un punto recuperable del árbol actual antes del refactor, **sin confundirlo con congelación final**. El fingerprint563fb189b19d06fdf4e254b0e56c0d718a2b5bc9 es un dato reportado que debe cotejarse. La reconstrucción1994/1994 ya reportada se reutiliza como antecedente; no vuelvas a tratar124 entradas como conteo de archivos.

Ingiere `C1-QA-01/INFORME.md`, `SKIPS.md`, `skips-11.4.3.tsv` y `C1-RCP-02/DECISION_DEFAULT.md`, `CONTRATO_COPIAS_FRONTEND.md`, `PRUEBAS.md`. Integra sus resultados antes de repetir trabajos costosos. Identifica procesos y destinos3399/18080/15173; preserva el laboratorio mientras sea útil. No mates todos los procesos PHP/MySQL ni borres bases por nombre aproximado.

## 2. Primer bloqueo: contratos monetarios, de extremo a extremo

Lee `REVISION_DE_19_PANTALLAS_Y_EXPORTACIONES.md`. Su R2-MONEY-01 está reproducido en el código remoto de agosto y coincide con las capturas: `computeSimpleEstimate` devuelve texto con separadores de miles; `InvoiceCart.moneyLabel` lo pasa a un parser que rechaza comas; `null` termina visible como cero.

Compara primero los módulos reales de C1. Ejecuta el diagnóstico adjunto si sus firmas siguen vigentes o escribe una regresión equivalente sobre las firmas nuevas. No adaptes el producto al diagnóstico heredado. Reproduce con backend real y navegador el mismo carrito:850+45, tasa sintética del 15 %, total1029.25. Otro caso:850+45+15→1046.50. La tasa es fixture, NO una decisión fiscal.

Refactoriza la frontera de datos y presentación: un tipo/camino canónico para centavos, uno para cantidad, uno para decimal de intercambio y uno para texto localizado. Sin importes formateados dentro del estado de negocio. Sin dos helpers homónimos con contratos distintos. Sin convertir errores, NaN, ausencia de respuesta o parsernull en0. Cero legítimo/exención, calculando, inválido, desconectado y total confirmado son estados distintos.

La confirmación no puede prometer0 y emitir1029.25. Usa el cálculo de dominio del servidor también para la prevalidación/preview financiero, sin emitir número ni pago. Si existe un contrato adecuado, reutilízalo; si no existe, define uno tipado y pruébalo. Gestiona respuestas tardías, carrito modificado, precios cambiados y doble acción. Antes de emitir/cobrar, verifica que la revisión confirmada corresponde al carrito/precio/reglas actuales; si cambió, solicita nueva revisión en vez de cobrar silenciosamente otro monto. No hace falta un nuevo framework ni arquitectura distribuida.

Separa el controlador de facturación en responsabilidades claras: estado del borrador, consulta/prevalidación, confirmación, emisión/pago y recuperación de comprobante. Una sola fuente alimenta el resumen, el diálogo y la acción. Mantén validación monetaria autoritativa y atomicidad del backend. Un fallo de PDF no vuelve a cobrar. Retira consumidores duplicados después de migrarlos y probarlos; no mantengas dos flujos principales en paralelo.

Casos mínimos:0 válido;0.01;999.99;1000.00;1029.25;1046.50;10,000 como presentación; cantidades2 y fraccionarias admitidas; importe mal formado; total ausente; impuesto no disponible; precio modificado; respuesta antigua; timeout tras commit; doble clic; Enter en campo frente a Enter/Espacio en botón enfocado. Comprueba importes antes y después de persistir, no solo que la pantalla contiene la palabra“Total”.

## 3. Rediseño estructural completo, no la misma UI con otro color

Relee las dos skills ya instaladas y sus referencias aplicables. No reinstales ni actualices a ciegas. Su función es perfeccionar el nuevo diseño, no obligarte a conservar el layout rechazado. El responsable de diseño debe revisar superficies renderizadas y trabajar con el implementador; entregar solo documentos no cierra su responsabilidad.

Dirección de producto: estación de caja institucional sobria, precisa y visualmente cuidada. Usa una escala tipográfica y de espaciado coherente, cuerpos legibles, cifras tabulares y jerarquía basada en la operación. Aprovecha primitives accesibles existentes, pero sustituye wrappers y layouts que produzcan tarjetas dentro de tarjetas o espacios sin utilidad. No reemplaces la aplicación por una landing ni copies un CRM.

| Superficie actual | Sustitución requerida | Criterio observable |
|---|---|---|
| Shell con títulos duplicados y múltiples estilos de encabezado | Un encabezado operativo y un patrón de navegación; estado de usuario/caja discreto; encabezados de página sin redundancia | Ruta, acción principal y ámbito reconocibles sin leer textos técnicos |
| Paciente y filtros consumen casi toda la ventana POS | Paciente compacto arriba; búsqueda y lista de servicios inmediatamente debajo; categorías secundarias compactas | En1366×768 al 100 %, carrito con datos y varias opciones de servicio visibles antes de desplazar |
| Cada línea del carrito se convierte en una tarjeta alta | Filas compactas: servicio, cantidad, precio unitario e importe; información secundaria en detalle | Revisar varias líneas sin saltar entre múltiples scrolls pequeños |
| Resumen y cobro con cifras incompatibles | Resumen fijo del contrato canónico y acción con monto verificado | Nunca cero por ausencia/error; total coincide con confirmación/servidor |
| Diálogo largo invade el viewport | Contenedor de altura máxima adecuada al viewport, cuerpo desplazable, encabezado/acciones alcanzables | Casos1,10,30 líneas y zoom del 200 %; cancelar/confirmar accesibles con teclado |
| Reportes/catálogo/usuarios con tarjetas y etiquetas repetitivas | Tabla principal y barra de filtros compacta; mostrar excepciones, no cuatro etiquetas iguales por fila | Información útil visible en el primer viewport; detalle sin perder filtros |
| Respaldo desconocido presentado junto a mensaje tranquilizador | Resumen de salud autorizado, estados tipados, última copia recuperable y acciones claras | Desconocido y sin respaldo no se representan como saludable |
| Ayuda extensa con vocabulario de implementación | Tareas breves, búsqueda alineada y solución enlazada al estado real | Sin“rail”, instrucciones obsoletas ni explicación del framework |

Resuelve acceso, inicio, POS, confirmación/pago/éxito, historial/detalle, caja/apertura/movimientos/arqueo/cierre, catálogo, reportes/consolidado/auditoría, usuarios/roles, ajustes, recibos, respaldos y ayuda/soporte. Inventaría las rutas presentes para no omitir alguna. No introduzcas controles inactivos como placeholders.

La accesibilidad es parte de la construcción: semántica nativa, foco, labels, errores, contraste, reflow, teclado y movimiento reducido. No quites bordes de inputs o foco para cumplir una receta de sombras. No uses escalado CSS de toda la página ni zoom reducido para que parezca caber. Las animaciones de acciones frecuentes no deben retrasar la operación.

## 4. Recibos: sustituir el flujo roto de configuración y el diseño efectivo

El artefacto entregado por el usuario es612 × 396 pt con texto5.2–8.5 pt. No aceptes como reparación que exista otro perfil carta correcto en un test separado. Completa el defecto6 y aplica/actualiza el contrato de copias C1 según el código real, con valores visibles y validación de enum. No convertir un enum desconocido en un select vacío.

Rastrea formulario→DTO→persistencia→asignación efectiva→snapshot de un nuevo documento→renderer→PDF descargado. Explica en configuración qué perfil se usa y por qué. Distingue nuevo default, asignación por puesto/usuario, borrador y documentos históricos. Prueba guardar, recargar, cambiar usuario/caja y volver a emitir. El preview debe ser el documento real del borrador sin guardar ni consumir correlativo; mostrar el perfil anterior con un aviso no cumple una vista previa del cambio.

Adopta carta vertical612 × 792 pt como perfil propuesto para las nuevas operaciones de esta entrega; A4 configurable. Márgenes iniciales12 mm; texto de detalle10–11 pt y jerarquía mayor para paciente/total. Son decisiones visuales de este refactor, no medidas obligatorias por ley. Conserva compatibilidad de los snapshots existentes; no rehagas retroactivamente un recibo emitido para cumplir el nuevo aspecto.

Comprobante: encabezado compacto con identidad autorizada, número y fecha claros, paciente, tabla de servicios con precio unitario e importe separados, totales destacados, método/referencia, firmas/sello y etiqueta de copia. Blanco y negro legible; no llenar papel de fondos decorativos. Paginación explícita, encabezados de tabla repetidos y sin títulos huérfanos. Implementa con CSS compatible con la versión real de Dompdf; no presupongas que el flex/grid del navegador se reproduce en ese motor.

Preview con relación de aspecto preservada, ajuste a página/ancho, zoom y navegación de páginas; no tres documentos diminutos dentro de un iframe con otro scroll. Original/copia1/copia2 deben indicar páginas y juego de copias sin multiplicación accidental en el diálogo del sistema.

Verifica solicitudes de impresión/reimpresión y descargas desde todas las rutas. El sufijo“(1)” de un archivo no demuestra una reimpresión: reproduce la acción y consulta el ledger. Mantén motivo auténtico, contador durable y marca correspondiente cuando sea reimpresión; no fingir que el navegador confirma salida de papel. Los documentos de laboratorio se identifican inequívocamente; no usarCAI de validación como autorización real.

## 5. Refactor de exportaciones y coherencia de reportes

Corrige los generadores, no solo los archivos adjuntos. Lleva métricas canónicas a UI/PDF/XLSX; formato se aplica en la salida. Distingue facturas, pagos y recibos aun cuando la muestra arroje5 en cada uno. Expón caja/sesión inequívocas, ámbito autorizado y significado del período. Revalida consolidado ya montado en C1, incluyendo medianoche, sesiones abiertas antes del período, pagos dentro del período y grupo histórico sin caja. No lo reconstruyas como ausente.

XLSX: usa rangos de título, encabezado, cuerpo y total calculados explícitamente para cada bloque. D4 de“Cobros por metodo” es participación1 y debe tener formato porcentual; no puede heredar General/estilo de encabezado. Los conteos se muestran enteros, dinero con dos decimales y porcentajes como porcentajes. Fechas y estados deben ser utilizables y localizados; conserva identificación técnica en columnas apropiadas, no como único texto del reporte. No apliques un estilo a todo el rango y luego supongas que preservó la semántica.

Prueba tablas vacías, una fila y muchas filas, porcentajes0/0.5/1, valores monetarios mayores de1000, conteos enteros, strings largos y fórmulas maliciosas en textos exportados. Verifica tipos y formatos en el XLSX generado además de comparar cifras.

PDF ejecutivo: resumen útil primero, detalle diario/anexos explícitos y paginación sin separar“POR ÁREA” de sus filas. Repetir encabezados y formatear fecha/estado. No ocultar información para que el PDF tenga menos páginas; reorganizarla con criterio. Comparar sumas de métodos, servicios, cajas y totales con la misma respuesta del servidor.

## 6. Equipo y validación que pueden rechazar la entrega

Conserva los doce especialistas, pero no los pongas a editar el mismo core. Hasta6 tareas independientes activas y2 cargas pesadas como punto inicial; ampliar solo con recursos y archivos independientes. Registrar sesiones reales no demuestra calidad por sí mismo.

Asigna `hs-finance` al contrato financiero backend; `hs-frontend` al estado/consumidores POS y shell; `hs-ux` al diseño/inspección junto al frontend; `hs-receipts` al recorrido completo de configuración/PDF; `hs-db` a migraciones necesarias; `hs-qa` a regresiones independientes. El coordinador asigna un dueño a exportaciones. `hs-review` revisa los cambios ya estabilizados de cada familia y sus pruebas. Backups/seguridad/runtime/release continúan con tareas separadas, sin convertir permisos de archivo en excusa para dejar un extremo sin cablear.

Primero demuestra el fallo con una prueba que lo detecte; después refactoriza y pasa esa misma regresión. Los recorridos de cobro, factura, PDF y exportación centrales usan backend/base de laboratorio reales, no responses fabricadas. Los tests con mocks se conservan para otros estados, claramente separados.

Es obligatorio ejercitar una venta mayor de1000 desde búsqueda hasta impresión/exportación, otra con cantidad2 y otra de cero legítimo. Prueba carrito editado rápidamente, respuestas antiguas, timeout/retry y permisos. Las comparaciones de monto se basan en contrato/valor numérico, no en buscar cualquier texto“L0.00” del saldo.

No cerrar por número de capturas ni porque axe tenga0. Para cada defecto del inventario, muestra antes/después del mismo estado y explica su resolución o una discrepancia comprobada. Revisa cada captura producida. No reemplaces selectores por textos menos claros para satisfacer una spec. Confirma el Enter del campo y la activación normal del botón enfocado, zoom real, diálogos largos y reduced motion.

## 7. Entorno, continuidad y entrega

El reporte C1 dice Docker/WSL roto, no apagado. Inspecciona el diagnóstico real y comunica la intervención mínima si requiere elevación. **No reprovisiones ni desregistres distros, borres discos/volúmenes o cambies licencias sin autorización específica y respaldo.** La validación del binario nativo11.4.3 en3399 no equivale a probar la imagen de despliegue; lee sus resultados y mantén esa distinción.

Continúa con la reparación funcional/visual en el laboratorio existente mientras runtime/instalador avanzan por su frente. Conserva funcionamiento sin Internet con servidor local y capacidad LAN; no añadas CDN, tipografías remotas ni IA como dependencia central. No instales herramientas de desarrollo en el equipo del cajero para terminar una instalación normal.

Después de resolver e integrar, ejecuta la regresión afectada y la final necesaria. Audita los skips por razón/cobertura, sin exigir un cero artificial. Un resultado antiguo no acredita el nuevo árbol. Recalcula el manifiesto completo incluyendo fuentes nuevas y demuestra reconstrucción; solo entonces congela el candidato de esa etapa. No etiquetes el refactor completo con un defecto P0/P1 local conocido sin corregir ni con la revisión de C1 sin veredicto.

Entrega primero resultados de producto: flujo monetario corregido, pantallas antes/después, comprobante descargado desde el flujo real, exportaciones y errores resueltos. Luego evidencia técnica y límites. Los controles físicos/institucionales pendientes siguen identificados aparte; no los uses para esconder código incompleto ni los marques como aprobados.

Para permitir que ChatGPT integre y revise el código directamente, exporta una copia reconstruible del árbol actual con fuentes, pruebas, manifiestos de dependencias, migraciones, scripts, plantillas y configuración de ejemplo. Usa el mecanismo de snapshot ya verificado y revisa su contenido. **Excluye `.env` reales, claves, credenciales, bases/dumps, logs con datos sensibles, `node_modules`, `vendor` y binarios no necesarios.** No subas ni compartas el ZIP automáticamente. Una lista de archivos o un informe no sustituye esa copia de fuentes.

Empieza por el defecto monetario y ejecuta en paralelo diseño/recibos/exportaciones con contratos y propietarios claros. No vuelvas a entregar como refactor global una colección de ajustes cosméticos sobre el mismo flujo roto.
