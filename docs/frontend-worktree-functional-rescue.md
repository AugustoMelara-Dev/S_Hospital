# Rescate funcional del worktree frontend

Fecha de inspeccion: 2026-07-12. Alcance: `git status`, diff no staged completo, archivos frontend no rastreados y pruebas modificadas. No habia cambios staged. Este inventario no valida ni recomienda conservar el rediseño; aisla comportamiento que no debe perderse si se descarta la capa visual.

## Resultado ejecutivo

El worktree contiene un rediseño transversal (componentes base, tokens y casi todas las vistas) mezclado con un grupo pequeno de cambios funcionales. La estrategia segura es no rescatar archivos completos: reimplementar cada comportamiento sobre la base limpia, con una prueba protectora primero. No deben rescatarse en bloque `package.json`, lockfiles, `components.json`, tokens CSS ni la coleccion de componentes nuevos.

No se detectaron cambios sustantivos de contrato API, autorizacion o seguridad. Hay UI de autenticacion y permisos modificada, pero las reglas, llamadas y condiciones permanecen esencialmente iguales. Los cambios de impresion observados son decorativos en la vista previa; no cambian formato, contenido ni llamada de impresion.

## Cambios funcionales que requieren rescate deliberado

| Clasificacion | Comportamiento encontrado | Archivo actual / destino recomendado | Prueba protectora antes de rescatar | Fase futura |
|---|---|---|---|---|
| funcional, bugfix potencial | Selector de rango con calendario, seleccion de intervalo y atajos `Hoy`, `7 dias`, `Este mes`, conservando valores ISO locales sin UTC. El rediseño elimina el atajo `Ayer` y oculta los inputs nativos; no copiar literalmente. | Actual y destino: `frontend/src/components/ui/date-range-picker.tsx` | Test de componente: seleccion parcial/completa, zona `America/Tegucigalpa`, fin de mes, limpiar, estado disabled, error accesible y todos los atajos existentes. | F1 filtros y reportes |
| funcional | Facturacion pasa de tres zonas simultaneas a asistente secuencial tambien en escritorio; conserva las tres regiones montadas y bloquea pasos futuros hasta completar paciente. | `frontend/src/features/invoices/components/NewInvoiceViewLayout.tsx`; prueba modificada en `NewInvoiceViewLayout.test.tsx` | Mantener/agregar tests: no avanzar sin nombre, avanzar/retroceder sin perder paciente ni carrito, no desmontar regiones, cobro solo desde revision, navegacion teclado/movil. | F2 flujo de facturacion (decision UX explicita) |
| funcional, permiso | Reglas operativas cambian Checkbox por Switch; respeta `canEdit` y mantiene los mismos setters. Es interaccion equivalente, no una regla nueva. | `frontend/src/features/settings/OperationalRulesView.tsx` | Test: solo lectura no alterna; editable alterna scanner/pagos parciales; guardar envia exactamente ambos booleanos y maneja error API. | F3 administracion y permisos |
| funcional, bugfix potencial | Notificaciones realtime y reportes migran de `design-system/primitives/Toaster` a `components/ui/sonner`. Puede reparar integracion visual, pero puede romper API de `notify` si las firmas difieren. | `frontend/src/lib/realtime/useBroadcastSync.ts`, `frontend/src/features/reports/ReportsView.tsx`, `frontend/src/layout/components/UserMenu.tsx`; definir un unico adaptador destino | Unit/integration: cada evento Broadcast invalida queries esperadas y emite una sola notificacion; error de reporte y cierre de sesion muestran mensaje; verificar montaje global del toaster offline. | F4 infraestructura de feedback |
| funcional, bugfix potencial | `RouteState` cambia botones/enlaces al API de Ant Design. El enlace usa `href` y la accion `onClick`; se elimina el icono de reintento. El cambio de libreria no debe rescatarse, pero si debe preservarse que href y callback sean accionables. | `frontend/src/design-system/patterns/RouteState.tsx` | Tests por cada kind: roles `alert/status`, heading level, detalle, callback una vez, enlace correcto y foco. | F4 estados y accesibilidad |
| funcional, reportes | Metodos de pago reemplazan barras CSS por Recharts; tendencia adopta `ChartContainer` y tooltip comun. Los datos exactos siguen en tabla. Es presentacion funcional, no contrato de negocio. | `frontend/src/features/reports/components/PaymentMethodPanel.tsx`, `TrendChart.tsx`, nuevo `frontend/src/components/ui/chart.tsx` | Tests con cero/sin datos/valores string, etiquetas de metodo, formato Lempiras, tabla exacta siempre disponible y grafico sin `NaN`; smoke E2E del reporte. | F5 reportes accesibles |
| funcional, catalogo | Catalogo agrega una vista alternativa en lista para ciertos breakpoints y mantiene acciones condicionadas por `canManage`. | `frontend/src/features/catalog/components/ServiceCatalogTable.tsx` | Test: servicio visible en tabla/lista, editar/activar solo con permiso, paginacion y nombres/precios exactos. | F6 catalogo responsive |
| funcional, navegacion | Configuracion fiscal agrega enlace explicito a `/settings/institutional-receipts` en Resumen y reorganiza tabs sin cambiar permisos. | `frontend/src/features/settings/FiscalSettingsView.tsx` | Test de ruta: enlace visible solo dentro del acceso permitido; tabs no exponen contenido fiscal sin `canViewFiscalSettings`; recibos abre ruta dedicada. | F3 administracion |

## Clasificacion del resto

### Visual descartable

Cambios de clases, bordes, radios, sombras, espaciado, colores, iconos, textos de encabezado y composicion sin alterar handlers dominan: `components/ui/*` existentes, `clinical-tokens.css`, motion, Login/PasswordChange, backups, caja, dashboard, catalogo, factura, historial, recibos, reportes, settings, soporte, accounting y shell. Tambien son evidencia visual descartable las PNG bajo `qa/` y `frontend/UI_REDESIGN_INVENTORY.md`.

La migracion visual parcial a Ant Design en `LoginView.tsx`, `PasswordChangeView.tsx` y `RouteState.tsx` no constituye funcionalidad rescatable como bloque. Introduce una segunda biblioteca y riesgo de incompatibilidad de props, foco, estilos y bundle offline.

### Seguridad

No se encontro una nueva regla de seguridad. Login conserva lockout/countdown, caps-lock, mostrar/ocultar password y submit existentes. Los cambios son de componentes y presentacion. Deben protegerse con los tests actuales de login, lockout, credenciales, accesibilidad y password change antes de descartar/reimplementar.

### Permisos

`PermissionGate.tsx`, matriz/roles/usuarios y varias vistas solo cambian presentacion. Las condiciones `allowed`, `canManage`, `canEdit`, `canViewFiscalSettings` siguen siendo la frontera relevante. La unica interaccion a auditar es Switch en reglas operativas y acciones responsive del catalogo, listadas arriba.

### API

No se observaron endpoints, payloads ni tipos API nuevos en el diff frontend. `apiClient` y contratos permanecen. Cualquier rescate debe evitar inferir reglas desde la UI y conservar backend como fuente de verdad.

### Impresion

`ReceiptPreview.tsx`, `InstitutionalReceiptSettingsView.tsx` y `ReceiptSettingsPreview.tsx` cambian estilos/controles visuales. No aparece cambio funcional de `window.print`, formato carta/media carta/A5, contenido institucional, QR/codigos ni contrato de PDF. Clasificacion: visual descartable; proteger con snapshot/print E2E institucional antes de limpiar.

### Pruebas

- `NewInvoiceViewLayout.test.tsx` si documenta el nuevo asistente y es la unica prueba claramente ligada a comportamiento nuevo.
- `frontend/e2e/refactor-total.spec.ts` solo aumenta timeouts y actualiza headings del rediseño; no protege reglas nuevas y es descartable salvo que se decida conservar esos nombres.
- Cambios pequenos en tests de UI, login, backups, reports y shell parecen ajustes de clases/textos/imports. Revisarlos contra el diff limpio; no trasladarlos automaticamente.

### Muerto o infraestructura no justificada

Los componentes nuevos `accordion.tsx`, `calendar.tsx`, `chart.tsx`, `collapsible.tsx`, `command.tsx`, `drawer.tsx`, `empty.tsx`, `input-group.tsx`, `popover.tsx`, `progress.tsx`, `radio-group.tsx`, `sonner.tsx`, `spinner.tsx`, `switch.tsx`, `vitest.shims.d.ts` y `pnpm-workspace.yaml` son infraestructura de rediseño. Solo `calendar/popover`, `chart`, `sonner` y `switch` tienen consumidores funcionales identificados; deben incorporarse unicamente si la fase correspondiente demuestra necesidad y pruebas. El resto es muerto/no justificado para este rescate.

Los cambios de orden y expansion en `package.json`, `package-lock.json` y `pnpm-lock.yaml`, Storybook/Playwright y `components.json` no deben rescatarse como funcionalidad. Hay dos lockfiles, lo que aumenta riesgo de deriva reproducible/offline.

## Riesgos prioritarios

1. Copiar el worktree completo mezclaria comportamiento con una migracion visual/de dependencias de gran alcance.
2. El selector de fechas puede introducir regresiones de accesibilidad, perdida del atajo Ayer y fechas locales en bordes de mes.
3. El asistente de factura cambia el flujo de escritorio; requiere aceptacion de caja y E2E crear-cobrar-imprimir antes de adoptarlo.
4. Cambiar toaster o botones entre bibliotecas puede compilar y aun perder notificaciones, foco o semantica.
5. Graficos nunca deben sustituir la tabla exacta ni convertirse en fuente de totales.

## Criterio de rescate

Para cada fila funcional: partir de un worktree limpio, escribir/confirmar la prueba indicada, portar el minimo comportamiento sin clases del rediseño ni dependencias no necesarias, ejecutar typecheck/lint/tests/build y cerrar en un commit Conventional Commit independiente por modulo.
