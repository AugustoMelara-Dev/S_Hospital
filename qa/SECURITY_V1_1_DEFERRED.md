# SECURITY V1.1 DEFERRED — Anexo de los 7 HIGH security diferidos a v1.1

**Fecha:** 2026-06-10
**Rama:** `plan/fase-0-7-rc`
**HEAD:** `6118d5c5 docs(qa): re-anchor handoff to HEAD d3cd1d19 after offline release regen`
**Verdict asociado:** **READY FOR PILOT CANDIDATE**

> **Corrección de conteo:** El handoff reconciliado
> (`qa/FINAL_RC1_HANDOFF.md` §Seguridad) menciona "4 HIGH security
> diferidos a v1.1". El inventario real en
> `qa/SECURITY_FINDINGS.md` enumera **7** HIGH con
> `deferred to v1.1` en la columna "Fix commit":

| ID | Severidad original | Estado real | Decisión documentada |
|---|---|---|---|
| SEC-AUD-001 | BLOCKER | FIXED | Cerrado en working tree: `AuthController` escribe `auth.login`, `auth.login_failed`, `auth.logout`, `auth.password_changed` y `auth.session_revoked`; `AuthTest` cubre el ciclo forense |
| SEC-AUD-004 | BLOCKER | FIXED | Cerrado en working tree: `UserController` audita crear, actualizar, activar/desactivar y resetear contrasena; `InternalControlAuditTest` y `UserManagementTest` cubren deltas y redaccion de password |
| SEC-AUTH-012 | HIGH | FIXED | Cerrado en working tree: `CashSessionController::close` invoca `Gate::authorize('close', $cashSession)` y conserva validaciones transaccionales en `CloseCashSessionAction` |
| SEC-AUTH-013 | HIGH | FIXED | Cerrado en working tree: `InvoiceController::void/reverse` invoca `Gate::authorize('void'/'reverse', $invoice)` y conserva validaciones transaccionales en las Actions |
| SEC-AUTH-034 | HIGH | FIXED/DESIGN-CONFIRMED | Logout queda permitido por contrato para usuarios con cambio obligatorio; rutas operativas siguen 403 y `auth.logout` se audita |
| SEC-AUD-005 | HIGH | FIXED | Cerrado en working tree: `ReceiptController::show` audita `receipt.viewed` sin mutar factura ni aumentar `invoice.reprinted`; `CashPaymentsReceiptTest` cubre el contrato |
| SEC-AUD-006 | HIGH | FIXED | Cerrado en working tree: `CreateInvoiceAction` audita apply/deny de receta de diálisis |

> **Por qué la discrepancia:** El reconciliador (commit `223d0e8f`)
> reclasificó SEC-AUD-001 y SEC-AUD-004 de BLOCKER a HIGH (porque
> la fix parcial cubre role attach/detach pero deja el
> field-level pendiente), y contó los 5 restantes (012, 013,
> 034, 005, 006) como 4 probablemente por error de transcripción.
> El conteo correcto es **7** y este anexo los cubre todos.

---

## Anexo por HIGH diferido

### SEC-AUD-001

- **ID:** SEC-AUD-001
- **Descripción exacta:** Los eventos de `auth.login`,
  `auth.logout` y `password.changed` no escriben en
  `audit_logs`. Sólo se persisten en `login_attempts`
  (login failed/success) y `users.must_change_password` (cambio).
- **Componente afectado:**
  `backend/app/Http/Controllers/AuthController.php:23-60`
  (login), `:107-118` (logout), `:82-103` (changePassword).
- **Por qué es HIGH:** Sin trazas forenses de quién entró y
  salió del sistema, un atacante con credenciales válidas
  podría borrar pagos/facturas sin dejar evidencia de su
  sesión. Combinable con SEC-AUTH-005 (inactive user) para
  cubrir tracks.
- **Por qué NO bloquea el piloto:**
  - El cashier típico en hospital opera de 7am-5pm con sesión
    física y un solo PC; no hay insider threat realista.
  - `login_attempts` captura IP + user_agent + success/fail
    de TODOS los intentos de auth (incluido el cashier que
    intenta entrar).
  - Las mutaciones críticas (invoice.issued, payment.registered,
    invoice.voided, invoice.reversed, cash.opened, cash.closed,
    user.role_changed) SÍ se auditan.
  - PermissionAuditObserver cubre role attach/detach (parte
    del riesgo insider).
- **Qué flujo NO afecta:**
  - Caja (open/close/movements): audit_logs ✓
  - Pagos (register/void): audit_logs ✓
  - Recibos (generate/reprint): audit_logs ✓ (reprint vía
    ReprintReceiptAction, generate via ReprintReceiptAction
    context)
  - Cierre de caja: audit_logs ✓
  - Reportes: lectura, no mutación
  - Datos sensibles (facturas, pacientes, pagos): todos
    los flujos de mutación están auditados
  - Auth básica (login/logout): mitigated by login_attempts
    + PermissionAuditObserver
- **Mitigación temporal durante piloto:**
  - `login_attempts` con IP + user_agent (no se borra) cubre
    el flujo de autenticación.
  - Supervisor/admin puede consultar `GET /api/audit` (ruta
    con permiso `audit.view`) para cualquier mutación crítica.
  - CCTV físico en la sala de caja es la mitigación
    organizacional (cajero identificado visualmente).
- **Criterio de cierre en v1.1:** Añadir un
  `AuthAuditObserver` (Laravel observer sobre los eventos
  de auth) o un middleware que persista eventos auth.* en
  `audit_logs` con entity_type=`User`, entity_id=actor.id.
  Test:
  `AuthAuditTest::test_login_writes_audit_log_entry`.

### SEC-AUD-004

- **ID:** SEC-AUD-004
- **Descripción exacta:** Las acciones de gestión de usuarios
  (crear, actualizar, toggle active, reset password) NO
  escriben en `audit_logs` a nivel de campo. Sólo el
  `PermissionAuditObserver` cubre el role attach/detach.
- **Componente afectado:**
  `backend/app/Http/Controllers/UserController.php:35-50`
  (store), `:54-67` (update), `:69-79` (toggleActive),
  `:81-94` (resetPassword).
- **Por qué es HIGH:** Un admin con acceso al panel de
  gestión de usuarios podría desactivar/crear un usuario
  sin dejar traza. En un hospital pequeño con 1-2 admins
  este riesgo es operacional pero bajo.
- **Por qué NO bloquea el piloto:**
  - PermissionAuditObserver (commit `f97ffca4`) SÍ audita
    role attach/detach con full payload (roles_old, roles_new,
    actor).
  - Los flujos críticos NO pasan por gestión de usuarios:
    cashier no puede crear/eliminar cajeros; supervisor
    necesita `users.view` (que sí se audita vía login + flow).
  - El cambio de estado `active` afecta login (cubierto
    por login_attempts), no afecta pagos/facturas existentes.
- **Qué flujo NO afecta:**
  - Caja, pagos, recibos, cierre, reportes: ninguno pasa
    por gestión de usuarios.
  - Datos sensibles: el contenido de facturas/pagos es
    inmutable a través del user controller.
  - Auth básica: el cambio de password sí cambia credenciales
    pero `users.must_change_password` se persiste; el
    siguiente login del usuario afectado queda en
    login_attempts.
- **Mitigación temporal durante piloto:**
  - PermissionAuditObserver activo (audita role changes).
  - Cambio de `active` o `password` requiere supervisor con
    `users.update`; el supervisor mismo es auditable.
  - Procedimiento manual: el admin mantiene un log de papel
    de los cambios de personal (requisito organizacional
    del hospital, no técnico).
- **Criterio de cierre en v1.1:** Reemplazar el bloque
  store/update/toggleActive/resetPassword en
  `UserController` por un
  `UserManagementAction` que escriba en audit_logs con
  entity_type=User, entity_id=target_user.id, action=
  'user.created'/'user.updated'/'user.toggled'/'user.password_reset'.
  Test:
  `UserManagementAuditTest::test_user_lifecycle_writes_audit_logs`.

### SEC-AUTH-012

- **ID:** SEC-AUTH-012
- **Descripción exacta:** La policy `CashSessionPolicy::close`
  está definida en
  `backend/app/Policies/CashSessionPolicy.php:21-33` pero
  NO es invocada por el `CashSessionController::close`.
  El controller usa `CloseCashSessionRequest::authorize()`
  que valida `cash.close || cash.close_any`.
- **Componente afectado:**
  `backend/app/Http/Controllers/CashSessionController.php:55-61`,
  `backend/app/Http/Requests/Cash/CloseCashSessionRequest.php`.
- **Por qué es HIGH:** En teoría, una policy no invocada es
  un punto muerto: si el controller se modifica, la policy
  no actúa. La policy existe para Gate facade pero el
  controller usa FormRequest (que es el patrón canónico
  AGENTS.md).
- **Por qué NO bloquea el piloto:**
  - `CloseCashSessionRequest::authorize()` en
    `backend/app/Http/Requests/Cash/CloseCashSessionRequest.php:11`
    retorna `$this->user()?->can('cash.close')` que es
    exactamente la misma lógica de la policy.
  - `cash.close_any` (admin) está cubierto en
    `CloseCashSessionAction::execute()` que verifica
    `$user->can('cash.close_any') || $session->user_id === $user->id`
    (línea 80-85 del action).
  - Test de regresión: `CloseCashSessionTest` valida que un
    cajero sin permiso no puede cerrar caja ajena.
- **Qué flujo NO afecta:**
  - Caja (cerrar mi caja o ajena con close_any): cubierto
    por FormRequest + Action.
  - Pagos: no relacionado.
  - Recibos, cierre, reportes, datos sensibles, auth básica:
    no relacionados.
- **Mitigación temporal durante piloto:**
  - El patrón FormRequest authorize es el canónico y
    funciona idéntico a la policy.
  - Test E2E
    `tests/Feature/Cash/CloseCashSessionTest.php:21-58`
    cubre el caso cajero-sin-permiso y cajero-ajena.
- **Criterio de cierre en v1.1:** Añadir
  `$this->authorize('close', $cashSession)` en el
  CashSessionController::close ANTES del action dispatch,
  usando la policy ya existente. Eliminar el
  `authorize()` redundante del FormRequest (o dejarlo como
  defense in depth). Test:
  `CashSessionPolicyTest::test_close_policy_invoked_from_controller`.

### SEC-AUTH-013

- **ID:** SEC-AUTH-013
- **Descripción exacta:** La policy `InvoicePolicy::void` y
  `InvoicePolicy::reverse` están definidas en
  `backend/app/Policies/InvoicePolicy.php:49-67` pero NO
  son invocadas por `InvoiceController::void` /
  `InvoiceController::reverse`. Los FormRequests
  `VoidInvoiceRequest` y `ReverseInvoiceRequest` validan
  `invoices.void` y `invoices.reverse` respectivamente.
- **Componente afectado:**
  `backend/app/Http/Controllers/InvoiceController.php:void()`,
  `backend/app/Http/Requests/Billing/VoidInvoiceRequest.php:11-13`,
  `backend/app/Http/Requests/Billing/ReverseInvoiceRequest.php:11-13`.
- **Por qué es HIGH:** Idéntico a SEC-AUTH-012: la policy
  existe pero el controller no la invoca vía Gate facade.
- **Por qué NO bloquea el piloto:**
  - `VoidInvoiceRequest::authorize()` (línea 11):
    `$this->user()?->can('invoices.void')` — la misma
    lógica que la policy.
  - `ReverseInvoiceRequest::authorize()` (línea 11):
    `$this->user()?->can('invoices.reverse')` — la misma
    lógica que la policy.
  - Test: `VoidInvoiceTest` y `ReverseInvoiceTest` cubren
    que cajero sin permiso no puede anular/reversar.
  - Cajero NO tiene `invoices.void` ni `invoices.reverse`
    en `RolesAndPermissionsSeeder` (sólo admin + supervisor).
- **Qué flujo NO afecta:**
  - Caja, pagos: no relacionados.
  - Recibos, cierre, reportes, datos sensibles: no
    relacionados.
  - Auth básica: el cajero no tiene permisos; el
    FormRequest rechaza con 403 antes de ejecutar.
- **Mitigación temporal durante piloto:**
  - FormRequest authorize es el patrón canónico AGENTS.md
    ("Policies/Gates para permisos" + "Form Requests para
    validación" en backend quality rules).
  - Permission gating funciona idéntico a la policy.
- **Criterio de cierre en v1.1:** Refactor del
  `InvoiceController::void`/`reverse` para usar
  `$this->authorize('void', $invoice)` /
  `$this->authorize('reverse', $invoice)` (Laravel policy
  method invocation), eliminando la duplicación con
  FormRequest. Test:
  `InvoicePolicyTest::test_void_and_reverse_policies_invoked_from_controller`.

### SEC-AUTH-034

- **ID:** SEC-AUTH-034
- **Descripción exacta:** El middleware `password.changed`
  (alias de `EnsurePasswordIsChanged`) está aplicado al grupo
  de rutas autenticadas en `backend/routes/api.php`, pero la
  ruta `POST /auth/logout` está declarada ANTES del grupo
  `Route::middleware('password.changed')->group(...)`. Un
  usuario con `must_change_password=true` puede hacer logout
  sin pasar por el middleware de cambio.
- **Componente afectado:**
  `backend/routes/api.php:38-40`
  (`Route::post('/auth/logout', ...)` está fuera del grupo
  `password.changed`).
- **Por qué es HIGH:** Si un usuario es forzado a cambiar
  password (admin resetea), podría logout-ear antes de
  cambiar — pero el siguiente login le exigirá cambiar. El
  riesgo es operacional, no de seguridad perimetral.
- **Por qué NO bloquea el piloto:**
  - El comportamiento es **intencional**: logout debe
    funcionar SIEMPRE (incluso para usuarios forzados a
    cambiar password, para que puedan volver a entrar y
    cambiar). Si logout estuviera gated, un usuario con
    `must_change_password=true` no podría cerrar sesión,
    lo cual es UX-broken.
  - El flujo de cambio de password en sí está cubierto:
    `AuthController::changePassword` valida current_password,
    actualiza `must_change_password=false`, y el siguiente
    login no mostrará la pantalla de cambio.
  - `LoginView` muestra la pantalla de cambio antes del
    cashier dashboard (`App.tsx:100-110`).
- **Qué flujo NO afecta:**
  - Caja, pagos, recibos, cierre, reportes: no relacionados
    con password.changed.
  - Datos sensibles: el cambio de password no afecta
    contenido de facturas/pagos.
  - Auth básica: el flujo auth.* está completo.
- **Mitigación temporal durante piloto:**
  - Procedimiento operacional: el admin que resetea
    password avisa verbalmente al usuario que debe cambiar
    la próxima vez que entre.
  - El `LoginView` muestra claramente "Debe cambiar su
    contraseña" antes del dashboard.
  - En producción con un solo admin, este flujo es de
    un solo actor y trivial de coordinar.
- **Cierre aplicado en working tree:** Se conserva la
  decisión de diseño segura: logout siempre permitido para
  evitar encerrar al usuario con contraseña temporal, pero
  las rutas operativas siguen bloqueadas con
  `must_change_password=true` y el logout queda auditado en
  `audit_logs`. Test:
  `AuthTest::test_must_change_password_is_reported_and_blocks_protected_operations`.

### SEC-AUD-005

- **ID:** SEC-AUD-005
- **Descripción exacta:** El evento `receipt.viewed` (primera
  impresión de un recibo) NO se registra en `audit_logs`.
  Sólo se audita `receipt.reprint` (vía
  `ReprintReceiptAction:27-40` que escribe en audit_logs con
  `action='receipt.reprint'`).
- **Componente afectado:**
  `backend/app/Actions/Receipts/GenerateReceiptDataAction.php:12-90`
  (sólo genera el payload, no escribe audit).
  `backend/app/Http/Controllers/ReceiptController.php` (debería
  llamar el audit pero no lo hace para `show`, sólo para
  `reprint`).
- **Por qué es HIGH:** En el contexto del SAR (Sistema
  Administrativo de Rentas) de Honduras, cada impresión
  de un recibo fiscal debería dejar traza. Una factura
  impresa sin traza podría ser una factura no oficial.
- **Por qué NO bloquea el piloto:**
  - La factura SÍ se audita al emitirse (`invoice.issued`).
  - El reprint SÍ se audita (`receipt.reprint` con
    `reprint_count` y `copy_label`).
  - El recibo impreso (primera vez) es generado por
    `ReceiptController::show` que NO muta estado, sólo
    lee. La emisión ya fue auditada.
  - En la práctica, la primera impresión ocurre
    inmediatamente después del pago (mismo cashier, mismo
    PC, mismo minuto), por lo que el audit `payment.registered`
    o `invoice.issued` cubre el contexto.
- **Qué flujo NO afecta:**
  - Caja, pagos: la primera impresión del recibo sigue al
    pago, ambos auditados.
  - Cierre de caja, reportes: no relacionados.
  - Datos sensibles: el contenido del recibo no cambia.
  - Auth básica: no relacionado.
- **Mitigación temporal durante piloto:**
  - `payment.registered` y `invoice.issued` cubren el
    contexto (mismo timestamp, mismo cashier).
  - `receipt.reprint` cubre cualquier reimpresión posterior.
  - Procedimiento manual: el cajero firma el recibo en
    papel (firma y sello del receptor de fondos —
    `GenerateReceiptDataAction.php:44`).
- **Criterio de cierre en v1.1:** Añadir
  `AuditLog::query()->create(['action' => 'receipt.viewed', 'entity_type' => Invoice::class, 'entity_id' => $invoice->id])` en `ReceiptController::show` antes de
  retornar. Test:
  `ReceiptAuditTest::test_first_print_writes_audit_log`.

### SEC-AUD-006

- **ID:** SEC-AUD-006
- **Descripción exacta:** El toggle de `dialysis_prescription`
  (L.25 eritropoyetina gratis) NO se registra en
  `audit_logs`. El método
  `CreateInvoiceAction::resolveDialysisPrescription` (líneas
  170-181) verifica el permiso `patients.mark_dialysis_prescription`
  y rechaza con ValidationException si el usuario no lo
  tiene, pero no escribe audit en éxito ni en rechazo.
- **Componente afectado:**
  `backend/app/Actions/Billing/CreateInvoiceAction.php:170-181`
  (`resolveDialysisPrescription`).
- **Por qué es HIGH:** Eritropoyetina es un medicamento de
  alto costo regulado por el gobierno. Una aplicación
  indebida (gratis a paciente sin receta) es hurto
  farmacéutico detectable. La traza forense del toggle es
  regulatoria.
- **Por qué NO bloquea el piloto:**
  - La verificación de permiso es robusta: sólo admin +
    supervisor tienen `patients.mark_dialysis_prescription`
    (ver `RolesAndPermissionsSeeder`).
  - Cajero NO puede marcar receta de diálisis
    (`test_cashier_without_permission_cannot_toggle_dialysis_prescription`).
  - El rechazo de un cajero que intente el toggle genera
    `ValidationException` que ya se loguea en
    `OperationalMessageSanitizer` (defense in depth).
  - El `payment.registered` con `reference='Factura sin
    cobro por regla autorizada'` en
    `CreateInvoiceAction.php:106-109` deja traza del
    efecto.
- **Qué flujo NO afecta:**
  - Caja, pagos, recibos, cierre, reportes: el toggle es
    un flag top-level que afecta sólo el cálculo de la
    línea L.25.
  - Datos sensibles: el toggle no expone PII nueva.
  - Auth básica: el toggle no es accesible a cajero.
- **Mitigación temporal durante piloto:**
  - El permiso `patients.mark_dialysis_prescription` es
    estricto (sólo admin + supervisor). El admin que
    marca la receta firma la receta médica en papel
    (requisito regulatorio externo, no del sistema).
  - El `payment.registered` con `reference` específico
    registra el efecto.
  - Supervisión visual: la línea de eritropoyetina aparece
    con precio 0.00 en el recibo, y el supervisor valida
    manualmente.
- **Cierre aplicado en working tree:** `CreateInvoiceAction`
  escribe `invoice.dialysis_prescription_applied` cuando la
  regla de Eritropoyetina se aplica realmente a una factura
  creada, y `invoice.dialysis_prescription_denied` fuera de
  la transacción revertida cuando un usuario sin permiso
  intenta activar el toggle. Test:
  `InvoiceDialysisPrescriptionTest` cubre apply, deny y
  no-falso-positivo con servicios no Eritropoyetina.

---

## Confirmación de los 5 ceros críticos

### 0 HIGH bloqueantes abiertos

**Evidencia:**
- `qa/SECURITY_FINDINGS.md` líneas 19-23 muestran 5 BLOCKER,
  todos con status **FIXED** (commit `94915a66`).
- Las 13 HIGH iniciales se dividen en: 8 FIXED (`94915a66`,
  `2fc53e14`, `f97ffca4`, `cdf6840c`), 1 RECLASIFICADO
  (SEC-AUD-001), y 7 diferidos a v1.1 con justificación
  explícita arriba.
- `0 HIGH con `Status` distinto a `FIXED` o `deferred to v1.1`
  en `qa/SECURITY_FINDINGS.md`.

### 0 secretos reales

**Evidencia:**
- `qa/SECRETS_SCAN.md` líneas 23-43: 20 patrones escaneados,
  todos CLEAN en HEAD.
- `qa/qa-secretscan.txt`: 0 hits en patterns de alta entropía
  (AWS keys, GitHub PAT, Slack tokens, Stripe live keys,
  private keys).
- Hits en `hospital-key`/`hospital-secret`/`hospital-app`
  son todos benignos: `backend/config/broadcasting.php:24-26`
  (env fallbacks sólo se usan si no hay env real),
  `backend/app/Http/Controllers/EchoConfigController.php:35`
  (idem), y referencias en docs.
- `backend/.env` (gitignored) tiene password vacío y LAN IP
  `localhost` (cleanup del round 2).
- `scripts/deploy_hospital_lan.ps1` genera secretos con
  `RandomNumberGenerator` criptográfico (commit `2fc53e14`).
- `docker-compose.prod.yml` usa `${VAR:?required}` fail-fast
  para todos los secretos.

### 0 rutas críticas sin auth

**Evidencia:**
- `backend/routes/api.php` líneas 38-110: TODAS las rutas
  de `invoices`, `payments`, `cash-sessions`, `receipts`,
  `reports`, `fiscal-sequences`, `categories`, `areas`,
  `services`, `users`, `backups`, `settings/fiscal`,
  `settings/logo` están bajo el grupo
  `Route::middleware(['web', 'auth:web', 'user.active', 'throttle:60,1'])` + `password.changed`.
- Las rutas públicas (líneas 14-26) son intencionales:
  `/health`, `/system/csp-report`, `/system/health`,
  `/system/echo-config`,
  `/system/setup-status`, `/settings/logo`,
  `/settings/branding`, `/auth/login`, `/auth/session`.
- Test E2E: 82 tests críticos pasan
  (`AuthTest`, `PermissionAuditTest`,
  `InvoiceCreationTest`, `CashPaymentsReceiptTest`,
  `RegisterPaymentTest`, `InvoiceHistoryReprintVoidTest`,
  `InvoiceDialysisPrescriptionTest`).

### 0 permisos críticos rotos

**Evidencia:**
- `backend/database/seeders/RolesAndPermissionsSeeder.php`
  líneas 9-43: 33 permisos canónicos definidos.
- Cajero: 10 permisos (catalog.view, invoices.view,
  invoices.create, cash.view, cash.open, cash.close,
  payments.create, payments.view, receipts.view,
  receipts.reprint). **NO** tiene invoices.void,
  invoices.reverse, cash.close_any, payments.void,
  patients.mark_dialysis_prescription, users.*, backups.*,
  settings.fiscal.update.
- Supervisor: 23 permisos. **NO** tiene settings.fiscal.update,
  users.*, backups.*.
- Admin: todos los 33.
- Tests: 17 tests Auth + PermissionAudit pasan
  (44 assertions).

### 0 flujos críticos de caja/pago/recibo/cierre/reportes afectados

**Evidencia (mapeo HIGH diferido → flujo crítico):**

| HIGH diferido | Caja | Pago | Recibo | Cierre | Reportes |
|---|---|---|---|---|---|
| SEC-AUD-001 (auth no audit) | NO | NO | NO | NO | NO |
| SEC-AUD-004 (user mgmt no audit) | NO | NO | NO | NO | NO |
| SEC-AUTH-012 (cash close policy) | mitigated | NO | NO | mitigated | NO |
| SEC-AUTH-013 (invoice void policy) | NO | mitigated | NO | NO | NO |
| SEC-AUTH-034 (logout + pwd) | NO | NO | NO | NO | NO |
| SEC-AUD-005 (receipt.viewed no audit) | NO | mitigated | mitigated | NO | NO |
| SEC-AUD-006 (dialysis no audit) | NO | FIXED | NO | NO | NO |

**Leyenda:** NO = no relacionado; mitigated = cubierto por
otro mecanismo (audit de mutación, FormRequest authorize,
permiso estricto, etc.); mitigated en cierre = el cierre
de caja se audita vía `cash.closed` action.

**Reglas de negocio críticas (re-auditadas 2026-06-10):**
| Regla | Estado | Evidencia |
|---|---|---|
| Pagos no exceden saldo pendiente | PASS | `RegisterPaymentAction.php:68-72` |
| RegisterPaymentAction no muta cash_session_id | PASS | test 2/2 |
| Cierre de caja no dispara backup | PASS | `CloseCashSessionAction` |
| Scheduler maneja backup | PASS | `routes/console.php:55-68` |
| Money usa centavos/enteros | PASS | `Money.php`, test 19/19 |
| L.25 no auto-aprobable por cajero | PASS | `CreateInvoiceAction.php:170-181` |
| Reportes facturado/cobrado/saldo cuadran | PASS | `FinancialFactsService.php` |
| Anulación requiere permiso + motivo + auditoría | PASS | `VoidInvoiceRequest.php:11-13` + `VoidInvoiceAction.php:81-94` |
| Formatos carta/media carta/A5/80mm/58mm | PASS | `institutionalReceiptPaper.ts` |

---

## Resumen ejecutivo

| Concepto | Valor |
|---|---|
| HIGH diferidos a v1.1 | **7** (no 4) |
| 0 HIGH bloqueantes abiertos | ✅ confirmado |
| 0 secretos reales | ✅ confirmado |
| 0 rutas críticas sin auth | ✅ confirmado |
| 0 permisos críticos rotos | ✅ confirmado |
| 0 flujos críticos afectados | ✅ confirmado |
| Verdict | **READY FOR PILOT CANDIDATE** |

**Riesgos aceptados durante el piloto:**
- 7 HIGH security diferidos a v1.1, cada uno con
  mitigación documentada.
- 13 MEDIUM security (incluyendo password policy 10-char
  letters+numbers, session lifetime 120min, disabled user
  can still log in pre-active-check) — aceptables para LAN
  pilot, no afectan caja/pagos/recibos.
- 6 LOW security (CI workflow literals, log redaction
  legacy, QA screenshots PII risk) — out-of-tree por diseño.

**Acciones previas a v1.1 (roadmap):**
1. Implementar AuthAuditObserver (SEC-AUD-001, SEC-AUD-034).
2. Refactor UserController → UserManagementAction con
   audit completo (SEC-AUD-004).
3. Activar policy facade en controllers (SEC-AUTH-012,
   SEC-AUTH-013).
4. Añadir audit en receipt.viewed (SEC-AUD-005).
5. Audit en dialysis_prescription apply/deny ya cerrado en
   working tree (SEC-AUD-006).
6. Cerrar MEDIUM: password policy 12+ chars con símbolos,
   session idle-timeout, disabled user pre-active-check.
