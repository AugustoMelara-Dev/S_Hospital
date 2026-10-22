# CONTRATO_PANTALLAS_V2 — Contrato por superficie para wave 2

Autor: hs-ux. Fecha: 2026-09-17. Raíz: `C:\Projects\S_Hospital_AI` (worktree aislado). Mandato §8, §9, §10, §12, §14, §22.
Método: lectura estática del código de este worktree + los tokens de `TOKENS_V2.md`. **No hay inspección renderizada**; los ítems visuales quedan NOT VERIFIED hasta que QA/frontend aporten evidencia (§22, `progreso/VISUAL.md`).
Alcance: contrato de estructura, jerarquía, estados, teclado y comportamiento responsivo. hs-ux no edita `frontend/src/**`. Los contratos funcionales previos `02-*` a `08-*` siguen vigentes en lo no contradicho aquí.

Referencia permanente: `hospital-ai/diseno/TOKENS_V2.md` (valores exactos de tipografía, color, espaciado, radios, sombras, foco, movimiento, iconografía).

---

## 0. Contrato común (aplica a toda superficie)

### 0.1 Shell y jerarquía
- Estructura fija: rail (256 px expandido / iconos colapsado) → `ContextBar` sticky (`ContextBar.tsx:34`) → `main` con `max-w-screen-2xl` (1536 px) y padding 12/20/28/32 px (`InstitutionalShell.tsx:161-163`).
- `ContextBar` muestra: destino actual, usuario, caja (`Mi caja #id` / `Mi caja cerrada`), estado de conexión **discreto** (punto/texto; no banner permanente). El aviso "Sin conexión" es textual, no solo color (`ContextBar.tsx:51-62`).
- Un solo `h1` por ruta desde `PageHeader` (eyebrow 12 px + `h1` `--type-h1` + descripción + acciones). Excepciones actuales a migrar: `FiscalSettingsView.tsx:75`, `NewInvoiceViewLayout.tsx:168`, `PasswordChangeView.tsx:43`, `RouteState.tsx:66`.
- Máximo dos niveles visuales por pantalla (fondo + superficie) y un solo acento.
- Prohibido: landing/hero, mensajes de bienvenida grandes, gráficos de relleno, gradientes arbitrarios, tarjetas anidadas, pantallas que parezcan otro producto (§8).

### 0.2 Estados obligatorios por ruta (§9)
Toda superficie declara y renderiza los cinco estados con `RouteState` (`RouteState.tsx:13`) u homólogo local:

| Estado | Componente | Requisitos |
|---|---|---|
| Carga | `RouteState kind="loading"` o skeleton con `role="status"` | texto "Cargando…", sin saltos de layout; `Suspense` ya monta "Cargando módulo…" |
| Vacío | `kind="empty"` o `Empty` | título + causa + **una** acción; distinguir "no hay datos" de "sin coincidencias por filtros" |
| Error | `kind="error"` `role="alert"` | causa legible + botón Reintentar + no perder el formulario |
| Éxito | feedback propio de la pantalla | persistencia confirmada antes de mostrarlo; nunca solo un toast |
| Sin permiso | `kind="denied"` vía `PermissionGate` (`components/PermissionGate.tsx`) | motivo textual y acción de salida; el rail ya no muestra el destino |

Reglas adicionales: nunca tapar información crítica con toasts; los errores se muestran junto al campo; no perder un formulario por fallo de red (§9).

### 0.3 Teclado (línea base)
- Primer Tab = skip link (`InstitutionalShell.tsx:143-145`). `main` tiene `tabIndex={-1}` y `scroll-mt-20`.
- `Ctrl+K` abre/cierra comandos (ya `InstitutionalShell.tsx:104-114`); `?` abre atajos; `Esc` cierra overlay y devuelve foco al disparador; `F4` navega a POS si el usuario es elegible.
- Orden de tabulación = orden visual/funcional; sin `tabindex > 0`.
- **Regla de Enter seguro:** `Enter` en un campo nunca dispara una operación monetaria irreversible. La confirmación de cobro/emisión usa `Ctrl+Enter` sobre un botón enfocado o clic. Ya implementado: `useNewInvoiceShortcuts.ts:61-71` (emisión abre confirmación) e `InvoiceConfirmation.tsx:18`. Se conserva y se prohíbe acortarlo.
- Antes de toda confirmación financiera se muestran paciente, conceptos, importe y método, con posibilidad de corregir (§10).

### 0.4 Responsive
| Matriz | Comportamiento |
|---|---|
| **1366×768 (primario)** | POS: paciente + servicios en columna principal y cuenta en columna derecha `min(420px,31vw)` desde 1280 px (`NewInvoiceViewLayout.tsx:73,256-267`); la tarea principal debe caber en el primer viewport. Caja e informes: primera ventana con métricas + primer bloque. |
| **1920×1080** | Ancho útil para tablas; columnas de acción no se estiran; el panel de cuenta mantiene su ancho (`min(360–420px)`) y hace sticky (`xl:top-20`). |
| **~390 px** | Una columna; cuenta del POS en bottom bar + drawer (`BillingBottomBar`/`BillingAccountDrawer`); **el total siempre visible**; tablas se convierten en filas apilables o scroll-x contenido en el contenedor, nunca en el documento. |
| **Zoom 125 % / 200 %** | Sin scroll horizontal de documento; reflow hasta 320 CSS px; el foco no queda oculto por barras fijas. |

Gate de aceptación transversal (`frontend/e2e/accessibility.spec.ts:181-189,333-344`): matrices claro/oscuro 1366×768, 1920×1080, 390×844, zoom 125 % y reflow 320–1920 px. Radios ≤16 px en los selectores del gate.

---

## 1. Acceso: login y cambio obligatorio de contraseña

Rutas: sin ruta (render condicional en `App.tsx:82-105`). Archivos: `features/auth/LoginView.tsx`, `features/auth/PasswordChangeView.tsx`, `design-system/components/InstitutionalIdentity.tsx`.

| Aspecto | Contrato |
|---|---|
| Estructura | Login: `main` centrado, tarjeta `max-w-md`, identidad institucional real (logo autorizado si existe; si no, solo texto) + separador + formulario. Cambio de clave: dos columnas ≥64rem (razones + formulario), una columna por debajo. |
| Jerarquía | `h1` = acción ("Iniciar sesión" / "Cambio obligatorio de contraseña"); identidad institucional antes del `h1` como `strong`/imagen, nunca como `h1` con nombre inventado. |
| Estados | Carga: botón con spinner + `aria-busy`, inputs deshabilitados. Error: `role="alert"`, texto real del servidor sin filtrar credenciales. Bloqueo: cuenta regresiva visible. Sesión vencida: mensaje explícito, no "error". |
| Teclado | Autofocus en usuario; Tab → contraseña → mostrar/ocultar → enviar; `Enter` envía el formulario de login (acción no monetaria). Caps Lock avisado con texto (`LoginView.tsx:146-150`). |
| 1366×768 | Tarjeta sin scroll; identidad + formulario visibles. |
| 1920×1080 | Tarjeta centrada, sin estirar; máximo cómodo de lectura. |
| ~390 px | Padding 16 px, botones a ancho completo, sin scroll horizontal. |
| Zoom | A 200 % la tarjeta fluye a una columna sin cortar el botón. |

Prohibiciones: no inventar escudo/sello; no prometer recuperación por correo externo (§14); no usar contraseñas universales.

---

## 2. Pantalla operativa (Inicio)

Ruta `/dashboard` (`AppRoutes.tsx:121-142`). Archivos: `features/dashboard/DashboardView.tsx`, `components/TodayLedger.tsx`, `OperationalQueue.tsx`.

| Aspecto | Contrato |
|---|---|
| Estructura | `PageHeader` + bloque de estado de caja/operación + accesos operativos (nueva factura, caja) + resumen del día + cola operativa. Las métricas son de trabajo, no decorativas. |
| Jerarquía | `h1` único; el estado de caja y la acción primaria (Nueva factura) dominan; métricas con `--type-metric`. |
| Estados | Carga con skeletons; vacío del día sin facturas ("Aún no hay operaciones hoy" + acción); error de carga con Reintentar; sin permiso operativo → `denied`. |
| Teclado | Acciones alcanzables por Tab en orden de lectura; `F4` a POS; sin atajos destructivos. |
| 1366×768 | Acción primaria y estado de caja en la primera ventana; el ledger puede desplazarse. |
| 1920×1080 | Métricas en una fila; cola y ledger con más ancho, sin estirar botones. |
| ~390 px | Métricas en 1–2 columnas; acciones a ancho completo; sin tabla horizontal del documento. |
| Zoom | Sin recorte de la acción primaria; foco visible por encima de cualquier barra. |

---

## 3. Nueva factura / cobro POS

Ruta `/billing/new` (guard completo `invoices.create+catalog.view+cash.view+payments.create+receipts.view`). Archivos: `features/invoices/NewInvoiceView.tsx`, `components/NewInvoiceViewLayout.tsx`, `PatientStep.tsx`, `ServiceSearch.tsx`, `InvoiceCart.tsx`, `BillingBottomBar.tsx`, `BillingAccountDrawer.tsx`.

### 3.1 Estructura
`PageHeader` ("Nueva factura", eyebrow "Facturación") → alertas de estado (caja no abierta, aviso, éxito de agregado) → workspace de 2 columnas:
- **Principal**: sección Paciente → sección Servicios (filtros área/categoría + búsqueda + resultados + "cargar más").
- **Cuenta** (columna estable ≥1280 px, sticky): líneas, cantidades, regla EPO, resumen monetario y botón de emisión.

### 3.2 Jerarquía (mandato §8)
1. **Total** = mayor peso visual (`--type-total`, 24 px/700, `tabular-nums`).
2. **Paciente** = segunda jerarquía, nombre completo sin truncar.
3. Servicio/descripción, cantidad, importe.
4. Metadatos (precio registrado, categoría/área, ISV) en `--type-sm`/`--type-xs`.
El estado de caja y la acción primaria deben verse sin desplazarse a 1366×768.

### 3.3 Estados
| Estado | Tratamiento |
|---|---|
| Carga de catálogo | skeleton en resultados + `role="status"`; búsqueda usable |
| Vacío de cuenta | panel "No hay servicios agregados" + causa + acción implícita (buscar) — `InvoiceCart.tsx:109-113` |
| Vacío de búsqueda | "Sin coincidencias" con causa, sin dejar panel en blanco |
| Error de carga | alerta + Reintentar (`onRetryLoad`), conservar borrador |
| Caja cerrada | alerta "Caja no abierta" + abrir caja o ir a caja; la emisión queda bloqueada con motivo textual |
| Éxito de agregado | alerta breve con nombre del servicio; no robar foco del buscador |
| Bloqueos de emisión | lista "Pendiente para emitir" junto al botón + botón con etiqueta descriptiva (`InvoiceCart.tsx:207-209`) |
| Envío | `aria-busy`, botón "Emitiendo…", bloqueo de doble submit (`confirmLockRef`) |

### 3.4 Teclado
- Foco inicial en paciente; `Ctrl+N` → paciente, `Ctrl+B` → búsqueda, `F6` → búsqueda (ignorado si hay overlay o diálogo) — `useNewInvoiceShortcuts.ts:40-51`.
- `Enter` en búsqueda agrega el primer servicio visible (acción reversible). Nunca cobra.
- `Ctrl+Enter`: si el carrito puede emitirse, **abre la confirmación**; si no, valida y enfoca el punto a corregir (paciente o búsqueda) — `useNewInvoiceShortcuts.ts:61-71`, `useNewInvoiceValidation.ts`.
- `Esc` con borrador abre "Limpiar factura en curso"; nunca descarta en silencio.
- Diálogos atrapan foco y devuelven al disparador.

### 3.5 Responsive
| Matriz | Comportamiento |
|---|---|
| 1366×768 | 2 columnas desde 1280 px; cuenta `min(420px,31vw)`; ambos visibles sin scroll horizontal. |
| 1920×1080 | Cuenta mantiene ancho; la principal gana resultados; sticky a `top-20`. |
| ~390 px | 1 columna; `BillingBottomBar` fija con **total siempre visible** + botón "Ver cuenta"; drawer con las líneas; teclado virtual no tapa el total. |
| Zoom 125/200 % | Reflow a 1 columna; sin recorte del botón de emisión; el total no se solapa con la bottom bar. |

Prohibiciones: no mover aritmética al frontend; no alterar la regla EPO; no cambiar snapshots ni idempotencia.

---

## 4. Pago, éxito y recuperación

Superficies: `PaymentModal.tsx`, `InvoiceConfirmation.tsx`, `InvoiceSuccess.tsx`; recuperación `receipt_outcome=recovery_required` (`NewInvoiceViewLayout.tsx:321`).

| Aspecto | Contrato |
|---|---|
| Estructura | Confirmación: paciente + conceptos + total + método, con acciones Cancelar/Confirmar. Pago: resumen (factura, paciente, total, recibido/cambio/saldo) + método + monto + referencia + acciones. Éxito: número, paciente, total, método/fecha/cambio, acciones Ver/Guardar/Imprimir/Nueva. |
| Jerarquía | Monto aplicado y saldo por encima del detalle; método y referencia legibles; "no repita la operación" visible durante el envío. |
| Estados | Validación local junto al campo (`PaymentModal.tsx:374-378,398-402`); error de servidor con Reintentar y sin borrar datos; parcial habilitado solo si el servidor lo permite; recuperación de comprobante **nunca** ofrece un segundo cobro. |
| Teclado | Foco inicial: campo de monto (efectivo) o referencia (tarjeta/transferencia) — `PaymentModal.tsx:103-116`. Radiogroup de método con flechas/Home/End y roving tabindex (`:153-182`). `Ctrl+Enter` envía solo desde el campo de monto. `Esc` cierra sin cobrar. |
| 1366×768 | Diálogo con scroll interno; resumen y acción siempre visibles. |
| 1920×1080 | Diálogo centrado `max-w-2xl`; no crece a lo ancho. |
| ~390 px | Acciones en columna invertida (primaria abajo, `flex-col-reverse`); targets ≥44 px. |
| Zoom | El resumen no se corta; el botón de confirmación permanece alcanzable. |

Correcciones de contraste detectadas: `PaymentModal.tsx:249` usa `text-primary-foreground` sobre superficie clara → `--color-muted-foreground`; etiqueta "Cambio:" (`:277`) pierde los dos puntos para consistencia.

---

## 5. Historial, detalle y anulación

Ruta `/invoices` (guard `invoices.view`). Archivos: `InvoiceHistoryView.tsx`, `history/InvoiceHistoryFilters.tsx`, `InvoiceHistoryTable.tsx`, `InvoiceDetailDrawer.tsx`, `InvoiceHistoryActionDialogs.tsx`.

| Aspecto | Contrato |
|---|---|
| Estructura | `PageHeader` + contador → filtros → alertas (criterio de conciliación, error, refresco) → tabla de trabajo en contenedor con borde → paginación. Detalle contextual en drawer con deep link `?invoice=<id>`. |
| Jerarquía | Número de factura y total como referencias primarias; paciente y fecha secundarias; **estado de pago siempre textual** (emitida/pagada/parcial/anulada + estado de recibo). Acciones por fila según permisos. |
| Estados | Vacío sin datos vs vacío por filtros (con "Limpiar filtros"); carga con skeleton y `role="status"`; error de carga con Reintentar; error de refresco diferenciado (`:104-110`); éxito de acciones con marca textual y recarga; sin permiso → drawer/botones ocultos, ruta con `denied`. |
| Teclado | Filtros completamente operables; Tab en orden filtros→tabla→paginación; fila seleccionable con `Enter`/`Espacio` cuando `onRowClick` (`DataTable.tsx:43`); detalle cierra con `Esc` y devuelve foco al disparador (`InvoiceHistoryView.tsx:171`). |
| Anulación/reverso | Diálogo con **motivo humano obligatorio**, autorización por permiso, marca visible en documento y auditoría. Nunca un solo clic; nunca borrar la factura. |
| 1366×768 | Filtros en una fila; la tabla debe mostrar al menos 8–10 filas antes del pliegue, con acciones en la primera columna congelada o al final. |
| 1920×1080 | Columnas: número, fecha, paciente, total, estado, recibo, acciones; sin estirar la columna de acciones. |
| ~390 px | Filas apilables (`renderMobileRow`) con dato clave (número, paciente, total, estado) y acción primaria; filtros en hoja/colapsables; sin scroll horizontal de documento. |
| Zoom | El drawer conserva el foco visible; la tabla permite scroll-x dentro de su contenedor. |

Riesgo histórico relacionado (HS-UX-01/07): la configuración de recibos era inalcanzable; ver §12.

---

## 6. Caja, arqueo y cierre

Ruta `/cashbox` (guard `cash.view`). Archivos: `CashBoxView.tsx`, `components/OpenSessionForm.tsx`, `CashDenominationCounter.tsx`, `CashMethodSummary.tsx`, `CashMovementsTable.tsx`, `CashClosingPanel.tsx`, `CloseSessionDialog.tsx`.

| Aspecto | Contrato |
|---|---|
| Estructura | `PageHeader` ("Caja") + barra de estado operativo (badge abierta/cerrada + métricas Apertura, Efectivo esperado, Ingresos, Saldo pendiente, Recibos pendientes) → alertas → una de: apertura, operación, arqueo/cierre, resumen de sesión cerrada. |
| Jerarquía | Diferencia de caja y efectivo esperado son la jerarquía máxima del cierre; la clasificación de métodos (efectivo vs tarjeta/transferencia) es explícita. Nunca afirmar "cuadra" solo por color. |
| Estados | Caja cerrada → formulario de apertura; en supervisión / modo consulta → aviso textual; carga con skeletons; error de sesión con Reintentar; bloqueo de cierre por pendientes o recibos pendientes con motivo; cierre exitoso con resumen imprimible. |
| Teclado | Conteo por denominación con entrada numérica y `inputMode`; Tab predecible por denominación; `Enter` avanza el foco al siguiente campo, **no cierra la caja**. Cierre exige confirmación explícita. |
| 1366×768 | Estado + métricas + primer bloque de arqueo en la primera ventana; el conteo no exige desplazamiento horizontal. |
| 1920×1080 | Métricas en una fila (grid de 6); movimientos con más ancho; sin estirar botones. |
| ~390 px | Métricas en 2 columnas; denominaciones a ancho completo; acciones de apertura/cierre a ancho completo; totales visibles. |
| Zoom | El conteo y la diferencia no se cortan; el foco no queda oculto por barras fijas. |

No se modifican reglas de bloqueo de cierre, conciliación, locks ni auditoría. El diálogo de cierre no debe parecer inocuo (§14).

---

## 7. Catálogo

Ruta `/catalog` (guard `catalog.view`). Archivos: `CatalogView.tsx`, `components/CatalogToolbar.tsx`, `ServiceCatalogTable.tsx`, `CategoryDrawer.tsx`, `ServiceDrawer.tsx`.

| Aspecto | Contrato |
|---|---|
| Estructura | `PageHeader` ("Catálogo institucional") + toolbar (búsqueda + filtros) + tabla paginada; alta/edición en drawer; categorías en drawer. |
| Jerarquía | Nombre y precio vigente por delante; estado activo/inactivo textual; acciones de edición separadas de la lectura. |
| Estados | Carga con skeleton; vacío sin datos vs sin coincidencias; error con Reintentar; éxito de guardado con marca y recarga; sin `catalog.manage` la vista es solo lectura (sin botones de edición). |
| Teclado | Búsqueda con debounce; Tab por toolbar→tabla→paginación; drawers cierran con `Esc` y devuelven foco; diálogo de motivo único (ver más abajo). |
| 1366×768 | Toolbar en una fila; tabla con nombre, categoría, precio, estado y acciones visibles. |
| 1920×1080 | Columnas completas; descripción puede ocupar el ancho ganado. |
| ~390 px | Filas apilables; toolbar en 2 filas (búsqueda + filtros); descripción de servicio envolvente. |
| Zoom | Precio nunca truncado ni dividido. |

Deuda a cerrar por hs-frontend: `CatalogView.tsx:436-444` usa un diálogo de motivo propio; se unifica con `ConfirmReasonDialog` (ver §13, patrón común).

---

## 8. Reportes

Rutas `/reports` (raíz), `/reports/executive`, `/reports/cash`, `/reports/audit` (guard `any` de `reports.managerial.view|cash_session.view|audit.view`). Archivos: `ReportsView.tsx`, `ReportsExecutive.tsx`, `ReportsCash.tsx`, `ReportsAudit.tsx`, componentes.

| Aspecto | Contrato |
|---|---|
| Estructura | `PageHeader` ("Informes y auditoría") + pestañas de subruta + filtros de alcance/fecha + bloques de resumen + tablas; exportación como acción secundaria ("Exportar", no primaria). |
| Jerarquía | Totales y deltas con signo **y texto** (`+`/`−` en número y palabra "aumentó/disminuyó"); los gráficos acompañan, nunca reemplazan la tabla (paridad gráfico/tabla). |
| Estados | Carga con skeletons por bloque; vacío por período ("Sin datos en el rango"); error por bloque con Reintentar sin tumbar el resto; sin permiso de exportación el botón no aparece; éxito de exportación con nombre de archivo y advertencia de que el evento digital no prueba salida física. |
| Teclado | Pestañas navegables con flechas; filtros operables; tablas ordenables por teclado; exportación enfocable. |
| 1366×768 | Título + filtros + primer bloque de totales en la primera ventana; tablas sin scroll horizontal de documento. |
| 1920×1080 | Gráficos y tablas lado a lado cuando aporte; no estirar tarjetas para llenar. |
| ~390 px | Una columna; gráficos con altura acotada; tablas apilables; filtros en hoja. |
| Zoom | Etiquetas de ejes y montos legibles; sin solapamiento. |

---

## 9. Auditoría

Subruta `/reports/audit` (guard `audit.view`). Archivos: `ReportsAudit.tsx`, `AuditSummaryPanel.tsx`.

| Aspecto | Contrato |
|---|---|
| Estructura | Resumen mensual + bitácora filtrable (fecha, usuario, acción, entidad, detalle) en `DataTable` con paginación. |
| Jerarquía | Fecha/hora y usuario autor son la clave de lectura; la acción se lee antes que el identificador técnico. |
| Estados | Carga; vacío ("Sin entradas de auditoría" — ya `ReportsAudit.tsx:78`); error con Reintentar; sin permiso → `denied` (no ocultar la ruta en silencio). |
| Teclado | Filtros y paginación por teclado; detalle largo con envoltura, sin truncar valores. |
| 1366×768 | Filtros + primeras filas visibles. |
| 1920×1080 | Bitácora más ancha; el detalle envuelve en varias líneas. |
| ~390 px | Filas apilables con acción y fecha + ver detalle. |
| Zoom | Las IP/referencias no se cortan (`WrapText`). |

Lectura de auditoría: la UI no edita ni borra; solo consulta y exporta según permiso.

---

## 10. Usuarios y roles

Ruta `/admin/users` (guard `users.view`). Archivos: `UsersView.tsx`, `components/UsersTable.tsx`, `UserManagementOverview.tsx`, `UserFormDialog.tsx`, `RoleFormDialog.tsx`, `PermissionMatrix.tsx`, `UserStatusToggleDialog.tsx`.

| Aspecto | Contrato |
|---|---|
| Estructura | `PageHeader` ("Usuarios y funciones") + resumen/overview + pestañas/páneles (directorio, roles) + diálogos de alta/edición/estado. |
| Jerarquía | Nombre de usuario y rol visibles; estado activo/inactivo textual; permisos agrupados por módulo en vez de una lista plana. |
| Estados | Carga; vacío "No hay usuarios cargados" vs "Sin coincidencias" (ya `UsersTable.tsx:28-31`); error con Reintentar; éxito de alta/edición con marca; sin permiso los botones no se montan. |
| Teclado | Diálogos con foco atrapado, `Esc` cierra y devuelve foco; matriz de permisos navegable con `Espacio` para marcar; **doble submit bloqueado** en alta/edición. |
| 1366×768 | Directorio + acciones visibles; diálogo con scroll interno. |
| 1920×1080 | Más columnas; no estirar la columna de acciones. |
| ~390 px | Lista apilable con nombre, rol, estado; acciones en menú; matriz de permisos desplazable dentro de su contenedor. |
| Zoom | El formulario fluye a una columna; los errores quedan junto al campo. |

Reglas no negociables: no borrar usuarios (desactivar), conservar autoría (§15).

---

## 11. Configuración fiscal y operativa

Ruta `/settings/fiscal` (guard `settings.fiscal.view | settings.operational.update`). Archivos: `FiscalSettingsView.tsx`, `FiscalNumerationView.tsx`, `HospitalSettingsView.tsx`, `OperationalRulesView.tsx`, `FiscalSummary.tsx`, `FiscalStatusCard.tsx`.

| Aspecto | Contrato |
|---|---|
| Estructura | `PageHeader` + pestañas Resumen/Hospital/Numeración/Operativa + formularios; el estado "sucio" y el guard de salida son visibles. |
| Jerarquía | Identidad institucional real y numeración por delante; marca/colores como personalización secundaria. |
| Estados | Carga; error de guardado junto al campo; guardado exitoso con confirmación persistente; sin permiso el formulario es solo lectura o `denied`; la numeración nunca se edita hacia atrás sin autoridad. |
| Teclado | Tab por pestañas→campos→guardar; `Esc` no descarta cambios sin confirmar ("descartar cambios"); el guard sticky no tapa el foco. |
| 1366×768 | Pestañas + primer bloque de formulario; guard de cambios no tapa campos. |
| 1920×1080 | Formulario en 1–2 columnas, sin líneas excesivamente largas. |
| ~390 px | Una columna; pestañas con scroll-x propio; guard de cambios **no** ocupa la acción principal. |
| Zoom | El guard sticky a 200 % no oculta el botón de guardar. |

Separación obligatoria (§14): la configuración cotidiana no se mezcla con mantenimiento peligroso. Cambiar un margen no debe requerir editar archivos.

Migración de encabezado: `FiscalSettingsView.tsx:75` `h1` "Configuración hospitalaria" → `PageHeader` con el mismo título (ya coincide con `accessibility.spec.ts:172`). Mantener "Configuración" como etiqueta de navegación.

---

## 12. Configuración de recibos

Ruta `/settings/institutional-receipts` (guard `receipt_settings.view`; entrada en navegación solo si el usuario no ve Configuración — `appNavigation.ts:317-340`). Archivos: `InstitutionalReceiptSettingsView.tsx`, `components/ReceiptSettingsPreview.tsx`, `modules/receipts/paperPolicy.ts`.

| Aspecto | Contrato |
|---|---|
| Estructura | `PageHeader` ("Recibos institucionales") + secciones de formato/copias/serie/identidad + panel de vista previa (`PrintPreviewFrame`) estable a la derecha en ≥lg, debajo en móvil. |
| Jerarquía | Formato de papel y número de copias primero; la vista previa muestra el efecto inmediato; separar edición administrativa de acciones del cajero. |
| Estados | Carga; borrador marcado "PRUEBA - SIN VALIDEZ" cuando no está guardado (`ReceiptSettingsPreview.tsx:102-106`); error de configuración con causa; guardado exitoso sin regenerar secretos ni números existentes; sin permiso de edición, solo lectura. |
| Teclado | Selects y campos operables; la vista previa no es un laberinto de Tab (iframe `sandbox=""` sin interactividad); al cambiar formato con `Espacio`/`Enter` la vista previa se actualiza sin perder foco. |
| 1366×768 | Controles + preview visible (el preview escala con `calculateReceiptPreviewScale`, `ReceiptSettingsPreview.tsx:31-40`). |
| 1920×1080 | Dos columnas; el preview no supera el 60 % del ancho. |
| ~390 px | Una columna; el preview conserva proporción y no genera scroll horizontal de documento. |
| Zoom | El preview se reescala por `ResizeObserver`; sin recorte lateral. |

**Advertencia de migración (mandato §12):** el estado actual es **apaisado** en los cuatro perfiles (`paperPolicy.ts:21-50`: `letter 11/8.5`, `half_letter 8.5/5.5`, `a5 210/148`, `custom 215.9/139.7`; `receipt-print.css:491-504`: `letter landscape`, `A5 landscape`). El mandato pide **carta vertical 215.9×279.4 mm (612×792 pt)** como principal y A4 210×297 mm configurable, con media carta y A5 no sinónimos. La adecuación de perfiles/PDF pertenece a hs-receipts; este contrato solo fija que la vista previa debe representar fielmente la orientación y el tamaño reales que emita el motor, sin prometer un formato que el PDF no produce.

---

## 13. Respaldos

Ruta `/backups` (guard `backups.view`). Archivos: `BackupsView.tsx`, `components/BackupPageActions.tsx`, `BackupHistoryTable.tsx`, `BackupStatusBadge.tsx`, `RecoveryReadinessCard.tsx`, `BackupSupportStatusPanel.tsx`.

| Aspecto | Contrato |
|---|---|
| Estructura | `PageHeader` + estado de protección/recuperación + acciones (crear/descargar, según permisos) + historial + panel de soporte/estado. |
| Jerarquía | Estado real (fecha del último respaldo, integridad, destino) antes que botones; **nunca** afirmar "copia externa protegida" si todo está en el mismo disco (§18). |
| Estados | Carga; vacío "Sin respaldos" con acción de crear; error de creación/descarga con causa; éxito con archivo real y fecha; sin permiso solo estado de lectura. |
| Teclado | Acciones enfocables y ordenadas; descargas no abren popups sin manejo de bloqueo; confirmación para acciones destructivas de restauración. |
| 1366×768 | Estado + acciones + primeras filas del historial. |
| 1920×1080 | Historial más ancho; acciones no se estiran. |
| ~390 px | Tarjetas apiladas; acciones a ancho completo; fechas y tamaños completos. |
| Zoom | Fechas/tamaños no se cortan. |

Separación obligatoria: restaurar no debe aparecer junto a "Imprimir prueba" ni como acción inocua (§14).

Migración de encabezado: `BackupsView.tsx:167` `h1` "Protección y recuperación" → se mantiene como título descriptivo, pero debe incluir la palabra respaldos para el gate (`accessibility.spec.ts:171` espera `/respaldos|backups/i`). Decisión propuesta: `PageHeader title="Respaldos"` + descripción "Protección y recuperación de copias locales".

---

## 14. Soporte, ayuda y acerca de

Rutas `/support`, `/help`, `/about` (sin `PermissionGate`, solo sesión; §F033, hs-security decide el gate). Archivos: `SupportCenterView.tsx`, `HelpView.tsx`, `AboutView.tsx`.

| Aspecto | Contrato |
|---|---|
| Estructura | `PageHeader` + contenido de consulta; ayuda con guía para cobrar, imprimir, cerrar caja y actuar ante fallos; soporte con estado/diagnóstico; about con versión y datos reales. |
| Jerarquía | La tarea de ayuda al operador primero; datos técnicos (versión, IP, modo) en bloque secundario. |
| Estados | Carga; vacío si no hay incidentes; error de diagnóstico con causa; **no** exponer secretos, tokens ni rutas internas sensibles. |
| Teclado | Contenido navegable; acordeones con `Enter`/`Espacio`; sin trampas de foco. |
| 1366×768 / 1920×1080 | Texto en ancho de lectura (`max-w-3xl`), no estirado a todo el ancho. |
| ~390 px | Una columna; bloques de código/valores envueltos. |
| Zoom | Sin scroll horizontal. |

---

## 15. Patrones compartidos obligatorios (una sola implementación)

Centralizar (§9): tablas (`DataTable`), filtros, paginación, formularios (RHF+Zod), diálogos, feedback y búsqueda. En particular:
- **Un solo diálogo de motivo**: `design-system/patterns/ConfirmReasonDialog.tsx` para catálogo, historial, caja y usuarios (cierra HS-UX-06; el prop muerto de `CatalogView.tsx:436` se elimina).
- **Un solo estado de ruta**: `RouteState`.
- **Un solo formato monetario**: `LempiraAmount` (sin lógica fiscal duplicada; el backend decide totales).
- **Una sola fuente de atajos**: `lib/shortcuts.ts` ↔ handlers reales (HS-UX-03; F2/F4/F6/F8 implementados o retirados del catálogo y la ayuda).
- **Un solo comportamiento de foco/teclado** para overlays descrito en §0.3.

---

## 16. Lo que este contrato NO autoriza

- No cambia aritmética monetaria, idempotencia, locks, snapshots, auditoría ni numeración.
- No cambia la regla EPO ni el flag de receta de diálisis.
- No fusiona factura fiscal y recibo institucional (§12).
- No inventa sellos, firmas, RTN, CAI, escudos ni identidad del hospital.
- No declara aprobación visual: los ítems renderizados quedan NOT VERIFIED hasta inspección con evidencia.
