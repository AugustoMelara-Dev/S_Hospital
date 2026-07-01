# QA visual final del refactor

Fecha: 2026-07-01  
Viewport usado: 1366 x 768  
Carpeta: `qa/refactor/screenshots/`  
Comando: `pnpm exec playwright test e2e/v1-2-visible-ui-a11y.spec.ts -g "refactor final screenshots evidence"`

## Resultado general

Se generaron y revisaron 19 screenshots. No hay evidencia visual de tabs excesivos, campos manuales de impresion para usuario normal, restore inseguro, ni botones flotantes tapando contenido. `/admin/roles` no existe como ruta SPA separada; roles se gestionan dentro de `/admin/users`.

## Evidencia por ruta

| Screenshot | Ruta / estado | Rol | Validado | Problemas detectados | Correccion aplicada | Estado |
|---|---|---|---|---|---|---|
| `dashboard.png` | `/dashboard` | admin | Jerarquia compacta, KPIs y actividad sin cards decorativas excesivas. | Ninguno critico. | No aplica. | OK |
| `billing-new-empty.png` | `/billing/new` vacia | cajero | Accion primaria clara, busqueda y paciente visibles, no dock flotante tapando. | Texto de confirmacion tenia mojibake en layout. | Texto corregido en `NewInvoiceViewLayout.tsx`. | OK |
| `billing-new-cart.png` | `/billing/new` con 2 servicios | cajero | Carrito con 2 servicios, total visible, boton `Emitir y cobrar` claro. | Ninguno critico. | No aplica. | OK |
| `billing-success.png` | Exito de nueva factura | cajero | Muestra numero, paciente, total, estado, `Imprimir`, `Nueva factura`, `Ver detalle`. | Ninguno critico. | Test actualizado para exigir esos elementos. | OK |
| `cashbox-closed.png` | `/cashbox` cerrada | cajero | Estado cerrado entendible y CTA para abrir caja. | Ninguno critico. | No aplica. | OK |
| `cashbox-open.png` | `/cashbox` abierta | cajero | Estado abierta, resumen por metodo, movimientos compactos. | Ninguno critico. | No aplica. | OK |
| `cashbox-close-diff.png` | Cierre con diferencia | cajero | Motivo obligatorio visible junto al cierre; no se oculta por boton fijo. | Ninguno critico. | Tests backend verifican 422 si falta motivo. | OK |
| `catalog.png` | `/catalog` | catalog/admin | Tabla compacta con columnas esenciales y acciones por fila. | Chips repetidos reducidos en refactor previo. | Sin nueva correccion. | OK |
| `catalog-edit-service.png` | Edicion de servicio | catalog/admin | Form dividido en datos, precio, reglas y estado; precio pide motivo. | Ninguno critico. | Backend test exige motivo/audit/historial. | OK |
| `invoices.png` | `/invoices` | admin | Busqueda y resultados recientes legibles; acciones no saturan tabla. | Ninguno critico. | No aplica. | OK |
| `invoice-void-reason.png` | Modal de anulacion | admin | Motivo obligatorio con dialog visible y contexto de factura. | Ninguno critico. | ConfirmDialog con motivo obligatorio. | OK |
| `reports-executive.png` | `/reports/executive` | admin | Solo nav de 3 vistas, filtros compactos, KPIs y graficas legibles. | E2E release esperaba heading antiguo de reportes. | `release-gate.spec.ts` ajustado a nav/regiones nuevas. | OK |
| `reports-cash.png` | `/reports/cash` | admin | Vista de caja sin tabs excesivos; resumen imprimible/operativo. | Ninguno critico. | No aplica. | OK |
| `reports-audit.png` | `/reports/audit` | admin/auditor | Auditoria separada y enfocada en anulaciones/reversos/cambios. | Ninguno critico. | No aplica. | OK |
| `backups.png` | `/backups` | admin | Tabla simple y estado de salud; no hay restore operativo. | Ninguno critico. | UI conserva restore fuera de operacion. | OK |
| `settings-fiscal.png` | `/settings/fiscal` | admin | Datos fiscales separados, advertencias de impacto, cambios criticos con motivo. | Ninguno critico. | Tests fiscales pasan. | OK |
| `receipt-settings-normal.png` | `/settings/institutional-receipts` normal | usuario con update sin advanced | No hay `width_mm`, `height_mm`, margenes, fuente, escala ni bloque soporte tecnico. | Visual QA detecto que el bloque "Modo soporte tecnico" se mostraba aunque deshabilitado. | UI ahora no renderiza el bloque si falta `receipt_settings.advanced`. | OK |
| `receipt-settings-advanced.png` | `/settings/institutional-receipts` soporte | soporte con advanced | Acordeon avanzado muestra campos manuales solo en perfil personalizado. | Ninguno critico despues de correccion. | Prop `canAdvancedPrintSettings` desde permisos. | OK |
| `admin-users.png` | `/admin/users` | admin | Usuarios y roles agrupados por tarea; no abruma con rutas separadas. | `/admin/roles` separado no existe. | Documentado como no aplicable; roles viven aqui. | OK |

## Auditoria visual dura

- Jerarquia: cada pantalla tiene una accion primaria reconocible; facturacion, caja y reportes no dependen de textos introductorios largos.
- Densidad: filtros de reportes quedan arriba y no dominan la pantalla; tablas de catalogo/historial/respaldos son escaneables.
- Color: estados criticos usan texto y color; no hay fondos decorativos de un solo color dominando la operacion.
- Accesibilidad: labels visibles, focus rings y modales con foco. Motivos obligatorios se muestran en dialog/textarea.
- Operacion hospitalaria: nueva factura es rapida, cierre de caja muestra diferencia/motivo, reportes responden cobros/caja/auditoria, recibos no exponen tecnica a usuarios normales.

## Screenshots generados

No se genero `admin-roles.png` porque la ruta no existe. Todos los demas nombres pedidos fueron generados.
