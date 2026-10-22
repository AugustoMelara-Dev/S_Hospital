# F2 — Correcciones funcionales (H-04…H-10)

Fecha: 2026-10-21 · Rama `release/entrega-20261021`.

## H-04 (Media) — Caja: «No se pudo confirmar el trabajo pendiente»

**Causa real**: `POST /api/cash-sessions/open` devolvía la sesión cruda, sin
`pending_invoice_count` / `pending_amount`; `GET /api/cash-sessions/current` sí
los devuelve. La UI guardaba la respuesta de `open` en la caché de `current` y,
hasta el siguiente refetch, no podía resolver el trabajo pendiente.

**Corrección** (`CashSessionController::open`): devuelve el mismo contrato que
`current` (`openSessionPayload` + conciliación). La sesión recién abierta ya
resuelve 0 pendientes.

**Prueba** (`CashRegisterOpenScopeTest`):
`test_open_returns_the_same_pending_work_contract_as_current_session` verifica
`pending_invoice_count=0`, `pending_amount="0.00"` y que `open` y `current`
coinciden en el id. ✅

## H-05 (Baja) — Chip «N concepto(s) en cuenta» persiste al cobrar

**Corrección** (`CobrarView.tsx`): el chip solo se muestra mientras la cuenta
está en edición (`!showResult`). Al quedar cobrada, desaparece.

**Prueba** (`CobrarView.test.tsx`): `deja de contar conceptos en cuenta cuando
la operación queda cobrada` (rojo antes del fix, verde después). ✅

## H-06 (Media) — Admin en «Roles en modo consulta»

**Causa real**: `VisiblePermissions` oculta `users.assign_admin_role` de la
sesión (por seguridad), pero la UI calculaba `canManageRoles` con ese permiso;
nadie podía editar roles.

**Corrección**:
- Backend: el payload de sesión expone `capabilities.manage_roles` calculado
  con el Gate, sin revelar el nombre del permiso.
- Frontend: `AuthUser.capabilities` + `useHospitalSession` usa la capability
  (con fallback al permiso para compatibilidad).

**Pruebas**: `AuthTest::test_session_exposes_role_management_capability_without_the_hidden_permission`
(admin true, cajero false, permiso oculto). ✅

## H-07 (Media) — Exportación Excel lenta

Pendiente de medición contra el servidor real (F3). Si supera 3 s, se perfila
`ExecutiveExcelExportService`. No se declara resuelto.

## H-09 (Baja) — `test:clinical` / `test:critical` apuntaban a vistas archivadas

**Corrección** (`frontend/package.json`): `NewInvoiceView→CobrarView`,
`InvoiceHistoryView→RecibosView`, `ReportsView→ReportesView`,
`DashboardView→ResumenView`, `HelpView→AyudaView`. ✅

## H-10 (Info) — Echo/Pusher sin servidor de websockets

**Verificado por diseño y prueba**: `getEcho()` solo importa `laravel-echo` /
`pusher-js` si `/api/system/echo-config` responde `enabled: true`. En producción
el driver es `null`, por lo que responde `enabled: false`, no se importa nada y
no hay reintentos.

**Prueba** (`EchoConfigTest`): `test_offline_default_disables_realtime_without_a_socket_server`. ✅

## H-02 / H-08

Se resuelven por diseño en F2B/F2C (impuestos configurables por producto y
«Importe» de línea sin impuesto). No se toca el CSV del catálogo ni el catálogo
vigente en esta fase.

## H-14 (avance, se cierra en F2B)

- Frontend: `DEFAULT_HOSPITAL_NAME = 'S_Hospital'`; los nombres heredados se
  sanean sin dejar el literal del hospital en el bundle.
- Seeder de distribución: nombre `S_Hospital`, ubicación vacía (sin ciudad).
- Fallbacks de `ReportController`: `S_Hospital`.
- Instalador: `AppPublisher=S_Hospital`; CA local `Organization="S_Hospital"`.
- Launcher: ventana «Iniciando S_Hospital…», Edge con
  `--user-data-dir=%LOCALAPPDATA%\S_Hospital\edge`, sin barra ni primer arranque.
- Pendiente en F2B: fallback de `HospitalName::display` y docblock de
  `ExecutivePdfExportService`, junto con el barrido de tests que citan el
  nombre heredado como dato de fixture.
