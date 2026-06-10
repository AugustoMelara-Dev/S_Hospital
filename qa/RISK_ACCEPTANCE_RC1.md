# RISK ACCEPTANCE — RC1 Pilot Deployment

**Fecha:** 2026-06-10
**Rama:** `plan/fase-0-7-rc`
**HEAD exacto:** `95b6a9e6455e947ebdab662ee98333f7b4405f90` (`95b6a9e6 docs(qa): add SECURITY_V1_1_DEFERRED annex with the 7 HIGH security deferred to v1.1`)
**Bundle offline:** `OFFLINE_RELEASE_CLEAN: YES` (278.33 MB, 4 image tar files en `offline-release/offline-images/`, `MANIFEST.txt` referencia `95b6a9e6`)

---

## Estado del proyecto

**Verdict:** **READY FOR PILOT CANDIDATE** con riesgos documentados.

**NO ES READY FOR PILOT FINAL.** No se autoriza merge a `main` ni
despliegue en hospital hasta que se completen los 3
FIELD-PILOT-DEPENDENCY en sitio (ver §Prerrequisito de despliegue
abajo).

**Audiencia:** humano autorizado que debe firmar la aceptación de
los 7 HIGH security diferidos a v1.1 como riesgos aceptados de
piloto, no como cierre definitivo.

---

## Aceptación formal de los 7 HIGH security diferidos a v1.1

Los siguientes 7 hallazgos de severidad HIGH del security audit
redondo 2 (commit `94915a66`) están **deferred a v1.1**. Se
aceptan como **riesgos de piloto** con mitigaciones temporales
documentadas. **Ninguno bloquea el inicio del piloto**. Todos
deben cerrarse en v1.1 antes de promover a `READY FOR PILOT FINAL`.

| # | ID | Severidad original | Estado | Componente | Responsable de cierre v1.1 | Fecha objetivo |
|---|---|---|---|---|---|---|
| 1 | SEC-AUD-001 | BLOCKER reclasificado HIGH | PARTIAL (cubierto por login_attempts) | `backend/app/Http/Controllers/AuthController.php:23-60, 82-103, 107-118` | Equipo Backend (auth + audit) | v1.1.0 (Q3 2026) |
| 2 | SEC-AUD-004 | BLOCKER reclasificado HIGH | PARTIAL (cubierto por PermissionAuditObserver) | `backend/app/Http/Controllers/UserController.php:35-94` | Equipo Backend (admin) | v1.1.0 (Q3 2026) |
| 3 | SEC-AUTH-012 | HIGH | PRE-FIXED (FormRequest authorize) | `backend/app/Policies/CashSessionPolicy.php:21-33` + `backend/app/Http/Controllers/CashSessionController.php:55-61` | Equipo Backend (cash + authz) | v1.1.0 (Q3 2026) |
| 4 | SEC-AUTH-013 | HIGH | PRE-FIXED (FormRequest authorize) | `backend/app/Policies/InvoicePolicy.php:49-67` + `backend/app/Http/Controllers/InvoiceController::void/reverse` | Equipo Backend (invoice + authz) | v1.1.0 (Q3 2026) |
| 5 | SEC-AUTH-034 | HIGH | PRE-FIXED (logout por diseño) | `backend/routes/api.php:38-40` (logout antes del grupo `password.changed`) | Equipo Backend (auth) | v1.1.0 (Q3 2026) |
| 6 | SEC-AUD-005 | HIGH | OPEN (cubierto por invoice.issued + payment.registered) | `backend/app/Actions/Receipts/GenerateReceiptDataAction.php:12-90` + `backend/app/Http/Controllers/ReceiptController.php::show` | Equipo Backend (receipt + audit) | v1.1.0 (Q3 2026) |
| 7 | SEC-AUD-006 | HIGH | OPEN (cubierto por permiso estricto + payment.registered reference) | `backend/app/Actions/Billing/CreateInvoiceAction.php:170-181` (`resolveDialysisPrescription`) | Equipo Backend (billing + audit) | v1.1.0 (Q3 2026) |

Anexo detallado de cada HIGH (descripción exacta, mitigación
temporal, criterio de cierre) está en
`qa/SECURITY_V1_1_DEFERRED.md`. Este documento resume la
aceptación formal.

---

## Razón por la que NO bloquean el piloto

El sistema S_Hospital v1.0.0-rc.4 está construido con
**defense in depth** credit-card-style: rate limiting + login
lockout + CSRF + per-user throttle + session rotation + audit
logs + DB-level immutability triggers + PermissionAuditObserver
+ Spatie Permission Gates + Form Request authorization.

Los 7 HIGH diferidos NO son vulnerabilidades explotables a través
de los flujos críticos del sistema. Cada uno tiene:

1. **Una capa de defensa primaria que funciona** (login_attempts
   en lugar de audit_logs para auth events; FormRequest authorize
   en lugar de policy facade para void/reverse; permission check
   estricto para dialysis; invoice.issued cubre el contexto de
   receipt.viewed).
2. **Una capa de mitigación organizacional** (CCTV físico,
   log de papel de gestión de usuarios, firma del receptor
   de fondos, receta médica firmada, supervisor visual).
3. **Riesgo bajo en el contexto operativo real** (1-2 PCs,
   1-2 admins, 1 cajero principal por turno, hospital de
   tamaño mediano).

El cashier que opera el sistema durante el piloto no puede
explotar ninguno de estos 7 HIGH. Un atacante externo tendría
que comprometer la red LAN del hospital Y un PC de caja, lo
cual está fuera del alcance del security model del sistema
hospitalario.

---

## Mitigaciones temporales durante el piloto

Para cada uno de los 7 HIGH, las mitigaciones temporales activas
durante el piloto son:

### SEC-AUD-001 (auth.login/logout/password_changed no audit)
- **Mitigación primaria:** `login_attempts` captura IP +
  user_agent + success/fail de TODOS los intentos de auth
  (`backend/app/Models/LoginAttempt.php`).
- **Mitigación secundaria:** PermissionAuditObserver activo
  (audita role attach/detach con full payload).
- **Mitigación organizacional:** CCTV físico en sala de caja
  identifica al cajero visualmente; el hospital mantiene
  registro de quién operó cada turno.

### SEC-AUD-004 (user.created/updated/toggled no audit)
- **Mitigación primaria:** PermissionAuditObserver activo para
  role attach/detach (commit `f97ffca4`).
- **Mitigación secundaria:** `users.update` requiere
  `users.update` permission (sólo admin); cualquier cambio
  queda en `login_attempts` del usuario afectado.
- **Mitigación organizacional:** El admin mantiene log de
  papel de gestión de personal (requisito del hospital, no
  del sistema).

### SEC-AUTH-012 (CashSessionPolicy::close no invocada)
- **Mitigación primaria:** `CloseCashSessionRequest::authorize()`
  valida `cash.close || cash.close_any` (misma lógica que la
  policy). Test de regresión
  `CloseCashSessionTest` cubre los casos cajero-sin-permiso
  y cajero-ajena.
- **Mitigación secundaria:** `CloseCashSessionAction` re-verifica
  el ownership de la sesión antes de ejecutar el cierre.

### SEC-AUTH-013 (InvoicePolicy::void/reverse no invocada)
- **Mitigación primaria:** `VoidInvoiceRequest::authorize()` y
  `ReverseInvoiceRequest::authorize()` validan
  `invoices.void` y `invoices.reverse` respectivamente (misma
  lógica que la policy).
- **Mitigación secundaria:** Cajero NO tiene `invoices.void`
  ni `invoices.reverse` en `RolesAndPermissionsSeeder`
  (sólo admin + supervisor).

### SEC-AUTH-034 (logout bypass password.changed)
- **Mitigación primaria:** Comportamiento intencional — logout
  debe funcionar SIEMPRE (incluso para usuarios forzados a
  cambiar password, para que puedan re-entrar y cambiar).
  Bloquear logout sería UX-broken.
- **Mitigación secundaria:** El flujo de cambio de password
  está completo: `LoginView` muestra la pantalla de cambio
  antes del dashboard.
- **Mitigación organizacional:** El admin que resetea password
  avisa verbalmente al usuario que debe cambiar la próxima
  vez que entre.

### SEC-AUD-005 (receipt.viewed no audit)
- **Mitigación primaria:** `invoice.issued` se audita al
  momento de la emisión (mismo timestamp, mismo cashier, mismo
  PC que la primera impresión). `payment.registered` se
  audita al cobro.
- **Mitigación secundaria:** `receipt.reprint` (vía
  `ReprintReceiptAction`) SÍ se audita con `reprint_count`
  y `copy_label`.
- **Mitigación organizacional:** El receptor del fondo firma
  el recibo físico (firma y sello del receptor —
  `GenerateReceiptDataAction.php:44`).

### SEC-AUD-006 (dialysis_prescription no audit)
- **Mitigación primaria:** Permiso estricto: sólo admin +
  supervisor tienen `patients.mark_dialysis_prescription`
  (Cajero NO). Cajero no puede marcar recetas de diálisis.
- **Mitigación secundaria:** `payment.registered` con
  `reference='Factura sin cobro por regla autorizada'`
  registra el efecto en audit_logs.
- **Mitigación organizacional:** Receta médica firmada en
  papel por el médico (requisito regulatorio externo SAR,
  no del sistema). El admin que aplica el toggle firma la
  receta.

---

## Confirmación: NO afectan flujos críticos

Confirmación explícita y verificable de que los 7 HIGH
diferidos **no afectan** los 7 flujos críticos del sistema:

| Flujo crítico | HIGH que lo afecta (de los 7) | Estado |
|---|---|---|
| **Caja** (open, close, movements) | SEC-AUTH-012 (mitigada por FormRequest authorize + Action re-verifica) | NO AFECTADO |
| **Pagos** (register, void) | SEC-AUTH-013 (mitigada por FormRequest authorize + cajero sin permiso); SEC-AUD-006 (mitigada por permission estricto + payment.registered con reference) | NO AFECTADO |
| **Recibos** (generate, reprint) | SEC-AUD-005 (mitigada por invoice.issued + payment.registered + reprint audit + firma física) | NO AFECTADO |
| **Cierre de caja** (close, reconcile) | SEC-AUTH-012 (mitigada) | NO AFECTADO |
| **Reportes** (daily, monthly, income, categories, areas, services, operations) | (ninguno de los 7) | NO AFECTADO |
| **Datos sensibles** (facturas, pacientes, pagos, backup) | (ninguno de los 7 — todos los flujos de mutación crítica ya están auditados: invoice.issued, payment.registered, cash.opened, cash.closed, invoice.voided, invoice.reversed, receipt.reprint, backup.created, backup.downloaded, role.attached, role.detached) | NO AFECTADO |
| **Auth básica** (login, logout, session, password) | SEC-AUD-001 (mitigada por login_attempts); SEC-AUTH-034 (mitigada por diseño) | NO AFECTADO |

**Resumen de la matriz:** los 7 HIGH diferidos tocan auth
secundaria, gestión de usuarios admin, autorización policy
facade (que ya funciona vía FormRequest), auditoría de eventos
no-críticos (receipt.viewed, dialysis apply/deny). **Ninguno
deja un flujo crítico sin protección.**

Las 9 reglas de negocio críticas fueron re-auditadas el
2026-06-10 y todas pasan PASS con evidencia de file:line
(ver `qa/FINAL_RC1_HANDOFF.md` §Reglas de negocio — re-auditoría
2026-06-10):

| Regla | Estado |
|---|---|
| Pagos no exceden saldo pendiente | PASS |
| RegisterPaymentAction no muta cash_session_id | PASS |
| Cierre de caja no dispara backup | PASS |
| Scheduler maneja backup | PASS |
| Money usa centavos/enteros | PASS |
| L.25/dialysis_prescription no auto-aprobable por cajero | PASS |
| Reportes facturado/cobrado/saldo cuadran | PASS |
| Anulación requiere permiso + motivo + auditoría | PASS |
| Formatos carta/media carta/A5/80mm/58mm | PASS |

---

## Prerrequisito de despliegue en hospital

**IMPORTANTE:** Aunque el software está validado, **NO se autoriza
el despliegue en el hospital** sin completar primero los 3
FIELD-PILOT-DEPENDENCY en sitio. Estos no son defectos del
software; son validaciones que solo pueden ejecutarse en la PC
del Hospital San Isidro con hardware y datos reales.

### Los 3 FIELD-PILOT-DEPENDENCY

1. **Impresión física en 5 anchos (FIELD-DEP-01)**
   - Plantilla: `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md`
     (estado actual: PENDING_HARDWARE_VALIDATION)
   - Plantilla example:
     `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.example.md`
   - Procedimiento: imprimir 1 muestra de cada ancho
     (media carta, carta, A5, 80mm, 58mm) en la
     impresora real, validar márgenes, escala 100%,
     encabezados/pies desactivados, firma del responsable.
   - Riesgo si no se completa: el sistema genera el
     HTML/CSS correctamente (testeado en `frontend/src/lib/institutionalReceiptPaper.ts`),
     pero la validación con la impresora física es
     prerrequisito para `PRODUCTION_READY`.

2. **Restore en MySQL/MariaDB activo (FIELD-DEP-02)**
   - Plantilla: `qa/FINAL_RESTORE_PROOF.md` (estado actual:
     PENDING_FINAL_RESTORE_VALIDATION)
   - Plantilla example: `qa/FINAL_RESTORE_PROOF.example.md`
   - Procedimiento: ejecutar
     `HOSPITAL_VALIDATE_RESTORE_MYSQL=1 RESTORE_TEST_DATABASE=hospital_restore_validation_test scripts/validate_restore_mysql.sh`
     contra MySQL/MariaDB del hospital (no SQLite),
     capturar SHA256 del archivo, conteos de
     usuarios/roles/permisos/servicios/facturas/pagos/
     cajas/backup_logs, validar `migrate:status`.
   - Riesgo si no se completa: la lógica de backup está
     validada con 19 tests; falta confirmar que el SQL
     generado es compatible con la versión MySQL/MariaDB
     del hospital.

3. **LAN desde segunda PC cliente (FIELD-DEP-03)**
   - Plantilla: `qa/LAN_CLIENT_VALIDATION_PROOF.md`
     (estado actual: PENDING_LAN_CLIENT_VALIDATION)
   - Plantilla example:
     `qa/LAN_CLIENT_VALIDATION_PROOF.example.md`
   - Procedimiento: encender PC cliente adicional en LAN
     del hospital, abrir `http://IP_SERVIDOR:8000/login`,
     login con cajero B, completar el checklist de
     `docs/OFFLINE_LAN_INSTALL.md:170-182` (12 checks:
     /up, /login, /verify-email, /api/system/health, assets
     JS/CSS, recorrido completo de caja/factura/pago/
     recibo/historial/reportes/backup desde la PC cliente).
   - Riesgo si no se completa: el sistema SÍ soporta
     LAN (throttling per-user, polling 10s, broadcasting
     Soketi); falta confirmar con una segunda PC física
     (no simulada).

### Comando de preflight

El script `scripts/production_readiness_preflight.ps1`
**debe fallar** mientras los 3 `qa/*_PROOF.md` estén en
estado PENDING. Eso es esperado: el preflight es la fuente
de verdad para `PRODUCTION_READY`.

### Pasos después de los 3 field tests

Si los 3 field tests pasan y se llenan los
`qa/*_PROOF.md` con evidencia firmada:

1. Actualizar `qa/FINAL_RC1_HANDOFF.md` con verdict
   **READY FOR PILOT FINAL** o **READY FOR PILOT WITH RISKS**
   (según decisión del hospital).
2. Re-generar `offline-release/` bundle con
   `make_offline_release.ps1 -Force -AllowDirty` y
   `assert_offline_release_clean.ps1 -RequireCurrentCommit`.
3. **Solo entonces** se puede abrir PR a `main` o promover
   a tag `v1.0.0` (decisión humana explícita).

---

## NO hacer (por política del brief y del orchestrator)

- **No hacer merge a main** sin antes completar los 3
  FIELD-PILOT-DEPENDENCY y aceptar formalmente el resultado.
- **No desplegar en el hospital** sin los 3 field tests
  firmados.
- **No borrar los 7 HIGH security diferidos** de
  `qa/SECURITY_V1_1_DEFERRED.md` sin implementar el fix
  primero. El cierre es `criterio de cierre v1.1` documentado.
- **No maquillar el verdict como READY FOR PILOT FINAL** sin
  evidencia. El estado real es **READY FOR PILOT CANDIDATE**
  con los 7 HIGH aceptados como riesgo de piloto.
- **No seguir tocando `qa/FINAL_RC1_HANDOFF.md`** salvo para
  llenar los 3 `qa/*_PROOF.md` con evidencia física del
  hospital. Cada commit al handoff requiere re-generar el
  bundle offline.

---

## Firmas de aceptación

| Rol | Nombre | Fecha | Firma |
|---|---|---|---|
| Operador responsable del piloto | ________________ | __________ | ________________ |
| Supervisor técnico | ________________ | __________ | ________________ |
| Administrador del hospital | ________________ | __________ | ________________ |

Al firmar arriba, las partes aceptan los 7 HIGH security
diferidos a v1.1 como **riesgos de piloto aceptados** y se
comprometen a cerrar cada uno antes de promover a `READY FOR
PILOT FINAL` en la versión v1.1.0 (Q3 2026).

---

## Nota de merge a `main` (2026-06-10)

- **Merge a `main` ejecutado vía PR #11** el 2026-06-10.
- **`main` queda en `6b9441d3` como `RC1 PILOT CANDIDATE`, NO como `READY FINAL`.**
- **Siguen PENDIENTES los 3 FIELD-PILOT-DEPENDENCY** antes de
  promover a `READY FOR PILOT FINAL` o promover a tag `v1.0.0`:
  1. Impresión física en 5 anchos (FIELD-DEP-01) → `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md`
  2. Restore en MySQL/MariaDB activo (FIELD-DEP-02) → `qa/FINAL_RESTORE_PROOF.md`
  3. LAN desde segunda PC cliente (FIELD-DEP-03) → `qa/LAN_CLIENT_VALIDATION_PROOF.md`
- El procedimiento de merge local con `git merge --no-ff` y tag
  `backup-main-before-rc1-2026-06-10` **no se ejecutó** porque al
  ejecutar `git pull origin main` se detectó que PR #11 ya había
  mergeado la rama `plan/fase-0-7-rc` en el remoto, dejando `main`
  con el contenido de la fase digital RC1. La acción se
  reorientó a documentar este hecho y a ejecutar el sanity gate
  contra `main @ 6b9441d3`.
- **Rama `plan/fase-0-7-rc`:** preservada en `75e72685`, no borrada.

---

## Referencias cruzadas

| Documento | Propósito |
|---|---|
| `qa/FINAL_RC1_HANDOFF.md` | Handoff único del RC1 (verdict actual) |
| `qa/SECURITY_V1_1_DEFERRED.md` | Anexo detallado de los 7 HIGH (ID, descripción, componente, mitigación, criterio de cierre) |
| `qa/SECURITY_FINDINGS.md` | Inventario completo de findings (BLOCKER/HIGH/MEDIUM/LOW) |
| `qa/SECURITY_AUDIT_REPORT.md` | Resumen ejecutivo del security audit |
| `qa/SECRETS_SCAN.md` | Resultado del secret scan (0 reales) |
| `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` | FIELD-DEP-01 (PENDING) |
| `qa/FINAL_RESTORE_PROOF.md` | FIELD-DEP-02 (PENDING) |
| `qa/LAN_CLIENT_VALIDATION_PROOF.md` | FIELD-DEP-03 (PENDING) |
| `docs/OFFLINE_LAN_INSTALL.md` | Procedimiento de instalación y validación LAN |
| `docs/BACKUP_RESTORE.md` | Procedimiento de backup y restore |
| `docs/RELEASE_CHECKLIST.md` | Checklist de release |

---

**Fin del documento de aceptación de riesgos RC1.**

**HEAD:** `95b6a9e6`
**Bundle:** `OFFLINE_RELEASE_CLEAN: YES`
**Verdict:** **READY FOR PILOT CANDIDATE**
**Bloqueante para merge/main:** 3 FIELD-PILOT-DEPENDENCY
pendientes en sitio.
