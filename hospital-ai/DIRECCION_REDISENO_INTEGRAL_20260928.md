# Rediseño integral — dirección compartida

Corrección del alcance tras rechazo explícito del usuario: no basta cambiar textos ni colocar componentes anteriores dentro de rutas nuevas. Todas las superficies operativas y secundarias deben tener composición y controles coherentes.

## Dirección de producto

- Azul #2563EB, blanco y neutros. Sin gradientes ni otra marca cromática. Estados semánticos discretos.
- Navegación principal lateral compacta, cabecera de contexto clara, área de trabajo amplia. Administración usa navegación horizontal de secciones: eliminar segundo riel lateral que estrecha el contenido.
- Una cabecera principal por pantalla, título específico y acciones a la derecha. Subtítulos sólo cuando ayudan a la tarea; retirar repeticiones de descripción/estado.
- Superficies de trabajo continuas: listas/tablas y formularios agrupados por separadores. Evitar tarjetas dentro de tarjetas, bandas de indicadores duplicadas y marcos en cada bloque. Radio moderado y consistente, foco visible, controles de 40–44 px, cuerpo 14–16 px.
- Un patrón de botones, campos, tabs, tablas, vacíos y diálogos. Las acciones primarias azules; secundarias neutras; iconos Lucide. Los diálogos tienen cabecera, cuerpo y pie de acciones estables con contenido desplazable.
- Cobrar mantiene cuenta continua en tabla. No convertir líneas en tarjetas. Rediseñar también confirmación, pago, vista previa y resultado.
- Recibos y Caja: incluir detalle, anulaciones, pagos, apertura, movimientos, arqueo, cierre e histórico; no conservar formularios antiguos bajo contenedor nuevo.
- Administración: catálogo/formularios/precios/categorías, usuarios/roles, identidad/numeración, respaldos y ayuda. Impresión avanzada fuera de tareas diarias. Instalar/actualizar corresponde al mantenimiento local, con instrucciones claras.
- No sustituir información monetaria ausente por cero. Preservar servidor, permisos, idempotencia, reglas y ayudas de recuperación ya probadas.

## Propiedad y comprobación

Root: `design-system/admin/{components.tsx,tokens.css}`, `shell/admin/**`, integración y dirección.
Frentes independientes: Cobrar/pagos; Recibos/Caja; Administración/Reportes; Acceso/Resumen; Instalador/actualización.
Todos los autores/revisores visuales leen better-ui y emil-design-eng. Un propietario por archivo. No tocar archivos comunes de root sin acuerdo. Una carga pesada a la vez; avisar antes de suites/build/DB/browser.

Aceptación: inventario completo con pantallas y diálogos, captura directa del resultado real por sección y acciones secundarias, recorridos con backend real y error/recuperación. El paquete final sólo se genera tras integrar UI; probar actualización aislada conservando datos, versión y configuración, además de fallo/recuperación. La instalación elevada y prueba física en PC destino se distinguen de la validación aislada.
