# Contratos de pantalla — Configuración, recibos (retirada), usuarios, respaldos, soporte y ayuda

Fuentes: `features/settings/*`, `features/receipt-settings/*`, `features/admin/*`, `features/backups/*`, `features/support/*`, `features/help/HelpView.tsx`, `features/about/AboutView.tsx`.

---

## SET-1 · Configuración hospitalaria (`/settings/fiscal`)

Guard: `settings.fiscal.view` | `settings.operational.update` (modo `any`, `appNavigation.ts:154-168`).

- **Propósito**: datos del hospital, numeración fiscal, reglas operativas y acceso a documentos institucionales. Título actual `h1` "Configuración hospitalaria" (`FiscalSettingsView.tsx:64`); badge "Edición habilitada / Edición operativa / Solo lectura" (`:69-71`).
- **Pestañas**: Resumen, Hospital, Numeración (solo con `settings.fiscal.view`) y Operativa (con `settings.operational.update`) (`:78-97`). La pestaña inicial depende del permiso (`:24`); si un editor operativo pierde el permiso fiscal, la UI fuerza "Operativa" (`:54-58`).
- **Estados**: carga de settings/secuencia sin spinner explícito (el contenido se puebla al resolver); error "No se pudo cargar la configuración." (`:43-47,74-76`); solo lectura explicada por badge; guardados con barras sticky de "cambios sin guardar" (`HospitalSettingsView.tsx:360`, `FiscalNumerationView.tsx:337`) y `dl` de resumen (`:380`, `:354`).
- **Acceso a recibos**: botón "Administrar recibos" → `/settings/institutional-receipts` (`FiscalSettingsView.tsx:88`), hoy retirada: **enlace circular** (HS-UX-01).
- **Permiso huérfano**: `receipt_settings.view` existe en `useHospitalSession.ts:46` pero ninguna ruta viva lo usa; un usuario solo con ese permiso no puede entrar a configuración (el guard exige fiscal u operativa). Decisión Tanda 2: misma pantalla con visibilidad de sección, o ruta propia restaurada.
- **Validación**: cambios fiscales/numeración requieren motivo y auditoría (`FiscalNumerationView.tsx:192`); el frontend no decide la validez de rangos, la refleja.
- **Aceptación Tanda 2**: un `h1`; pestañas navegables por teclado (`role="tab"`); guard sticky no cubre el foco al llegar al final del formulario; estado "hay cambios sin guardar" textual; salida segura sin perder cambios.
- **Pendiente visual**: comportamiento real del guard sticky a 390x844 (spec `settings-flow.spec.ts:80-94` ya modela la geometría; no ejecutada).

## SET-2 · Recibos institucionales (ruta retirada `/settings/institutional-receipts`)

- **Estado actual**: `AppRoutes.tsx:244-247` redirige a `/settings/fiscal`; `appNavigation.ts:170-185` conserva la definición con `receipt_settings.view` y migas autorreferentes; la vista `InstitutionalReceiptSettingsView` (878 líneas) existe sin cablear (`frontend/src/features/receipt-settings/InstitutionalReceiptSettingsView.tsx:134`).
- **Contrato funcional requerido** (PROMPT_MAESTRO §7C y F002): una entrada canónica desde Configuración que no vuelva a sí misma; URL histórica útil (redirección) si se decide integrarla como sección; edición administrativa separada de las acciones del cajero; controles visibles solo si el backend los respeta (tamaño/orientación, márgenes, tipografía, logo/sello legítimo, copias, perfil, serie, prueba de impresión, ORIGINAL/PRIMERA COPIA/SEGUNDA COPIA).
- **Prohibiciones**: no fabricar sellos/firmas; no prometer control de impresión física de PDFs descargados; no duplicar formularios.
- **Evidencia de expectativa externa**: `e2e/clinical-receipts.spec.ts:30`, `e2e/print-profiles.spec.ts:33,73,106`, `e2e/accessibility.spec.ts:173` esperan una pantalla "Recibos institucionales" en esa URL.
- **Aceptación Tanda 2**: decidir ruta canónica con hs-receipts/hs-frontend; enlace de Configuración apunta a un destino funcional; ninguna miga apunta a la misma pantalla dos veces; guard con `receipt_settings.view` coherente con el destino.

## ADM-1 · Usuarios y roles (`/admin/users`)

Guard: `users.view`; acciones con `users.create/update/disable/assign_admin_role` (`AppRoutes.tsx:248-265`; `useHospitalSession.ts:47-51`).

- **Propósito**: cuentas individuales, roles operativos y matriz de permisos.
- **Estados**: carga con skeletons "Cargando usuarios" (`UsersView.tsx:320-322`); error "No se pudieron cargar los usuarios" + Reintentar (`:324-336`); directorio con búsqueda; vacío de búsqueda "Sin coincidencias" en escritorio (`UsersTable.tsx:30`) y **sin mensaje en la lista móvil** (`UsersTable.tsx:28`) → HS-UX-04.
- **Diálogos**: `UserFormDialog` (identidad, rol, modo avanzado de permisos, `globalError`), `RoleFormDialog` (nombre 3-80 `[A-Za-z0-9_-]`, ≥1 permiso visible, `RoleFormDialog.tsx:175-182`), `PasswordResetDialog`, `UserStatusToggleDialog` con motivo.
- **Protecciones**: no desactivar el último admin activo; no auto-desactivarse; rol protegido bloqueado (`UsersView.tsx:120-122,237-242`; `UsersTable.tsx:35-39`).
- **Doble submit**: `saveRoleInFlightRef` (`:64,183`), `toggleUserInFlightRef` (`:73,272`); el alta/edición de usuario **no tiene ref de vuelo**: añadir guard en Tanda 2.
- **Mensajes**: éxito/fracaso con nombre del usuario; nunca mostrar el catálogo de permisos ocultos (`users-view.helpers.ts`).
- **Aceptación Tanda 2**: un `h1` "Usuarios y funciones"; matriz de permisos usable por teclado y con contraste; móvil con estado vacío; acciones destructivas piden motivo; sin filas truncadas.

## ADM-2 · Respaldos (`/backups`)

Guard: `backups.view`; crear `backups.create`; descargar `backups.download`; estado avanzado `system.status.view` (`BackupsView.tsx:48-50`).

- **Propósito**: estado, creación y descarga autorizada de copias locales; preparación de recuperación.
- **Estados**: carga "Cargando respaldos locales..." (`:250-252`); error con `RouteState` + Reintentar (`:254-259`); vacío `BackupEmptyState` (`:288-290`); filtro por estado y paginación (`:265-283`); alertas de "respaldo no confirmado", pendientes viejos y bloqueos de readiness (`:238-248`).
- **Confirmaciones**: crear respaldo (diálogo) y descargar respaldo con fecha/tamaño/usuario (`:293-323`).
- **Doble submit**: `creatingBackupRef` y `downloadingBackupRef` (`:45-46,108-113,137-141`).
- **Diferenciación sin color**: tarjetas con texto "Último exitoso/Pendientes/Fallidos" y helper textual (`:188-214`); nunca comunicar éxito solo por tono.
- **Cuidado de lenguaje**: no afirmar copia externa ni recuperación verificada si solo hay copia local; conservar la distinción "última copia recuperable vs última tarea" (PROMPT_MAESTRO §7F; F019).
- **Aceptación Tanda 2**: un `h1`; crear/descargar no duplicable; estado "no disponible" explícito cuando el status global no carga; sin prometer RPO/RTO.

## SOP-1 · Soporte (`/support`)

- **Propósito**: guías de turno, recuperación segura y diagnóstico local; `system.status.view` habilita el detalle avanzado (`SupportCenterView.tsx:19,76-82`).
- **Estados**: error `Empty` con "Reintentar diagnóstico" (`:70-72`); alerta de continuidad operativa ("registre hora, pantalla y usuario antes de repetir una acción") (`:74`); sin secretos en pantalla.
- **Contrato**: el diagnóstico debe redactar datos sensibles (`safeClientMessage`, `:45-46`); el resumen debe distinguir "no disponible" de "sin problemas".
- **Aceptación**: un `h1` "Asistencia operativa"; carga con estado textual; sin overflow; enlaces/acciones reales.

## AYU-1 · Ayuda (`/help`) y Acerca de (`/about`)

- **Ayuda** (`HelpView.tsx:337-338`, `h1` "Ayuda institucional"): índice de tareas, responsabilidades por rol, evidencia local para soporte y atajos. Contrato: el contenido de atajos debe venir del catálogo (`shortcuts.ts`) y no listar teclas inexistentes (HS-UX-03). No inventar políticas.
- **Acerca de** (`AboutView.tsx:63-64`, `h1` "Informacion del sistema"): identidad del hospital, versión/estado local, dependencias y soporte. Contrato: no exponer secretos, rutas absolutas del servidor ni detalles internos; la marca provisional debe declararse como provisional (`InstitutionalIdentity`).
- **Aceptación**: ambos con un `h1`; sin tablas de datos personales; impresión no exige estilos especiales.

## ROUTE-2 · Estados de acceso en estas pantallas

- Cualquier acceso sin permiso usa `PermissionGate`/`RouteState kind="denied"` con motivo humano y enlace a ayuda (`PermissionGate.tsx:20-28`).
- Los estados deben ofrecer **una** acción de recuperación (reintentar, pedir rol, volver al inicio) y no dejar al operador sin salida.
