# Auditoría de seguridad — `docs/security-audit.md`

> Matriz viva de acciones críticas, permisos, audit log y validaciones de backend. Refleja el estado tras el refactor.

## 1. Modelo de permisos

Roles oficiales del sistema (definidos en `RolesAndPermissionsSeeder`):

| Rol | Descripción |
|---|---|
| `admin` | Control total: usuarios, roles, configuración, respaldos, restauración. |
| `supervisor` | Operación ampliada: anulación, reversos, exportación, configuración fiscal, auditoría. |
| `cajero` | Operación local: caja, facturación, cobros, reimpresión. |
| `auditor` | Solo lectura de auditoría y reportes. |
| `catalog` | Gestión de catálogo de servicios. |
| `soporte` | Soporte técnico, incluye `receipt_settings.advanced`. |

Permisos clave (no exhaustivo):

- `users.assign_admin_role` — solo admin y root.
- `backups.restore` - no operativo: no se siembra, se oculta si existe como legado y ninguna policy lo autoriza desde la app.
- `receipt_settings.advanced` — soporte (nuevo en este refactor) — desbloquea los 8 campos manuales de impresión.
- `fiscal.sequences.reset` — admin (nuevo) — para reiniciar correlativo fiscal cuando no hay facturas emitidas.
- `settings.fiscal.update`, `receipts.void`, `invoices.reverse`, `payments.void`, `cash.close_any`, `invoices.operate_any` — supervisor/admin (consolidado en `RoleCatalog::ELEVATED_ROLE_PERMISSIONS`).

## 2. Matriz de acciones críticas

Leyenda:
- **A** = audit log obligatorio (`audit_logs`).
- **M** = motivo obligatorio (textarea, longitud mínima `5` caracteres, max `500`).
- **I** = idempotencia verificada via middleware `idempotency` y tabla `idempotency_keys`.
- **P** = permiso específico del backend.

| # | Acción | Endpoint | Permiso | A | M | I | Validaciones extra |
|---|---|---|---|---|---|---|---|
| 1 | Login OK | `POST /api/auth/login` | público | sí | – | – | lockout 5/15 min (`LoginAttempt`), CSRF |
| 2 | Login FAIL | `POST /api/auth/login` | público | sí | – | – | lockout, motivo adicional si está bloqueado |
| 3 | Crear factura | `POST /api/invoices` | `invoices.create` | sí | – | sí | paciente no vacío, 1+ items, cantidades > 0, precios snapshot, correlativo bajo transacción |
| 4 | Anular factura | `POST /api/invoices/{invoice}/void` | `invoices.void` | sí | sí (≥5) | sí | factura no anulada previamente, no pagada totalmente |
| 5 | Reversar factura | `POST /api/invoices/{invoice}/reverse` | `invoices.reverse` | sí | sí (≥5) | sí | factura activa, motivo y auditoría |
| 6 | Crear pago | `POST /api/invoices/{invoice}/payments` | `payments.create` | sí | – | sí | caja abierta, factura existe, balance disponible, movimiento de caja |
| 7 | Abrir caja | `POST /api/cash-sessions/open` | `cash.open` | sí | – | sí | sin caja abierta del mismo usuario |
| 8 | Cerrar caja | `POST /api/cash-sessions/{id}/close` | `cash.close` | sí | sí si diff≠0 | sí | efectivo contado numérico, sin facturas pendientes |
| 9 | Diferencia de caja | (auto al cerrar) | – | sí | sí | – | se registra `cash_session.difference` además del cierre |
| 10 | Anular pago | `POST /api/invoices/{invoice}/payments/{payment}/void` o `POST /api/payments/{payment}/void` | `payments.void` | sí | sí (≥5) | sí | pago no anulado, factura activa, caja cerrada no recibe movimiento nuevo |
| 11 | Reimprimir recibo legacy | `POST /api/invoices/{invoice}/reprint` | `receipts.reprint` | sí | opcional | sí | no emite documento nuevo; registra auditoría de reimpresión |
| 12 | Emitir recibo institucional | `POST /api/institutional-receipts` | `receipts.view`/flujo operativo | sí | – | sí | serie activa, rango vigente, recibo asociado a factura |
| 13 | PDF/print event recibo institucional | `POST /api/institutional-receipts/{receipt}/pdf`, `POST /api/institutional-receipts/{receipt}/print-events` | `receipts.view`/`receipts.reprint` | sí | opcional | sí | reimpresión auditada sin consumir correlativo |
| 14 | Cambiar precio de servicio | `PATCH /api/services/{service}` | `catalog.manage` | sí | sí (≥5) | – | precio anterior → historial y snapshot histórico en facturas |
| 15 | Cambiar perfil impresión (básico) | `PATCH /api/settings/institutional-receipts/print-profiles/{profile}` | `receipt_settings.update` | sí | – | – | no permite campos manuales sin `receipt_settings.advanced` |
| 16 | Cambiar perfil impresión (avanzado) | `PATCH /api/settings/institutional-receipts/print-profiles/{profile}` | `receipt_settings.advanced` | sí | – | – | cualquier campo manual exige permiso; sin él → 403 + audit |
| 17 | Cambiar CAI / rango / prefijo | `PATCH /api/fiscal-sequences/{fiscalSequence}` | `settings.fiscal.update` | sí | sí (≥5) | – | no reiniciar `current_number` sin `fiscal.sequences.reset` |
| 18 | Crear respaldo | `POST /api/backups` | `backups.create` | sí | – | sí | storage disponible, job local, checksum/auditoría al completar |
| 19 | Descargar respaldo | `GET /api/backups/{backupLog}/download` | `backups.download` | sí | – | – | solo archivos registrados dentro de `storage/app/backups` |
| 20 | Restaurar respaldo | `POST /api/backups/{id}/restore` | ninguno operativo | **no implementado** | - | - | ver seccion 3 |
| 21 | Crear usuario | `POST /api/admin/users` | `users.create` | sí | – | – | password policy (12+ chars, upper/lower/digit/symbol) |
| 22 | Actualizar usuario | `PATCH /api/admin/users/{user}` | `users.update` | sí | sí si cambia rol | – | impide auto-demote del último admin |
| 23 | Cambiar rol | (subconjunto de update) | `users.update` | sí | sí | – | impide quitar todos los admin |
| 24 | Crear/editar rol | `POST /api/admin/roles`, `PATCH /api/admin/roles/{role}` | `users.assign_admin_role` | sí | – | – | rechazar nombre `admin`/`root` |

## 3. Restauración de respaldos — **no disponible en UI**

> El backend actual **no** expone un endpoint de restauración seguro. La regla es:
> "Restaurar un respaldo sobre datos reales sin confirmar integridad, motivo y respaldo previo es una bomba de tiempo."

### Estado actual

- `POST /api/backups/{id}/restore` → **no implementado** (no aparece en rutas).
- La UI de Respaldos **no** muestra botón "Restaurar" — intencional.
- El descargable sí está disponible (`GET /api/backups/{id}/download`) con audit.

### Restricciones para implementación futura

Si en el futuro se requiere restaurar desde la app, el flujo será:

1. Crear e introducir un permiso operativo nuevo para restauracion; `backups.restore` permanece fuera del seeder actual hasta que exista este flujo seguro.
2. Verificación de integridad SHA256 del archivo.
3. Confirmación visual con `ConfirmDialog` que exige motivo ≥ 20 caracteres.
4. Bloqueo de la app durante la operación.
5. Backup automático **previo** a la restauración.
6. Audit log con `action="backup.restored"` + antes/después del checksum.
7. Rate limit por usuario/equipo.

Hasta entonces, **la restauración se hace desde el servidor** por personal autorizado fuera de la app.

## 4. Validaciones de backend obligatorias

### 4.1 Doble emisión

- `POST /api/invoices` requiere header `Idempotency-Key` en el middleware `idempotency`.
- La tabla `idempotency_keys` conserva `user_id`, ruta, clave, fingerprint del body, status y respuesta 2xx cifrada.
- Reintento con la misma clave y mismo payload reproduce la respuesta original con `Idempotent-Replay: true`.
- Reintento con misma clave y payload distinto devuelve error de conflicto/validación.
- El frontend conserva la clave por intento en factura, pago, apertura/cierre de caja y respaldo manual; solo la renueva cuando el backend confirma éxito.

### 4.2 Anti-XSS en nombres

- Backend: `strip_tags` + `mb_convert_encoding` en `patient_name` y `service_name` antes de persistir.
- Frontend: renderiza con texto plano; nunca `dangerouslySetInnerHTML`.

### 4.3 Estados de documento

- `Invoice`, `Payment`, `InstitutionalReceipt`, `CashRegisterSession` tienen transiciones de estado controladas vía Actions; no se actualizan con `fill()` directo.

### 4.4 Idempotencia

Las mutaciones criticas de tipo `POST` que pueden duplicarse por retry humano,
timeout LAN o doble submit usan el middleware `idempotency`: `POST /api/invoices`,
anulacion/reversion de factura, pagos, apertura/cierre de caja, reimpresion,
recibos institucionales y respaldo manual. Otras mutaciones administrativas
siguen protegidas por permisos, validaciones, auditoria y throttling, pero no se
documentan como idempotentes si la ruta no usa ese middleware.

Los clientes frontend que pueden sufrir reintento humano despues de timeout conservan una clave estable por intento:

- `useCreateInvoice` / `NewInvoiceView` para emisión de factura.
- `NewInvoiceView` para registro de pago.
- `useOpenCashSession` y `useCloseCashSession` para apertura/cierre de caja.
- `useCreateBackup` para respaldo manual.
- `InvoiceHistoryView` para anular, reversar, reimprimir recibo legacy, generar recibo institucional faltante y abrir PDF institucional con motivo de reimpresion.

### 4.5 CORS LAN y headers operativos

- `backend/config/cors.php` permite metodos explicitos (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`) en lugar de wildcard.
- El preflight acepta `Idempotency-Key` y `X-XSRF-TOKEN` para clientes Vite/LAN autorizados.
- Las respuestas pueden exponer `X-S-Hospital-Paper-Size-Warning` para que el frontend avise cambios de papel durante turno.
- Produccion conserva rechazo de wildcards en origenes para no abrir CORS credentialed accidentalmente.

## 5. CSRF y sesión

- `apiClient` con `csrf.ts` envía `X-XSRF-TOKEN` desde cookie `XSRF-TOKEN`.
- Sanctum `stateful` configurado para `SANCTUM_STATEFUL_DOMAINS` (LAN).
- `SESSION_SECURE_COOKIE=false` por HTTP en LAN; `HOSPITAL_ALLOW_INSECURE_HTTP=1`.

## 6. Headers de seguridad

- `X-Frame-Options: DENY`.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: same-origin`.
- `Content-Security-Policy: report-only` con `report-uri`.

## 7. Helper de auditoría

Centralizado en `App\Support\AuditLogger`:

```php
AuditLogger::record(
  action: 'invoices.void',
  entityType: Invoice::class,
  entityId: $invoice->id,
  oldValues: [...],
  newValues: [...],
  reason: $request->input('reason'),
  request: $request,
);
```

Reglas:

- Siempre incluye `user_id`, `ip`, `user_agent`, `url`, `http_method`.
- Si la acción es destructiva o privilegiada → exige `reason`.
- `audit_logs` es **inmutable** (sin `update`/`delete` desde Actions).

## 8. Tests de seguridad (objetivo)

| Test | Cobertura |
|---|---|
| `LoginLockoutTest` | 5 fallos consecutivos bloquean 15 min |
| `CreateInvoiceIdempotencyTest` | misma key → 1 factura creada |
| `VoidInvoiceRequiresReasonTest` | sin motivo → 422 |
| `CloseCashRequiresReasonOnDifferenceTest` | sin motivo → 422 |
| `UpdateServicePriceRequiresReasonTest` | sin motivo → 422 |
| `UpdateReceiptProfileRejectsAdvancedFieldsTest` | sin `receipt_settings.advanced` + width_mm → 403 |
| `UpdateReceiptProfileAcceptsAdvancedFieldsTest` | con permiso → 200 + audit |
| `ResetFiscalSequenceRequiresPermissionTest` | sin `fiscal.sequences.reset` → 403 |
| `UpdateUserRoleBlocksLastAdminTest` | intenta dejar 0 admins → 422 |
| `AuditLogImmutableTest` | no se pueden borrar filas |

## 9. Riesgos abiertos

1. Sin tests de penetración automatizados (no hay suite de DAST). Verificar manualmente después de cada release.
2. CSRF depende de cookie; si el operador cierra el navegador, Sanctum puede renovar. Verificar `SESSION_DRIVER=database` y `SESSION_LIFETIME=120`.
3. `restore` de backups sigue dependiendo de proceso manual en servidor. Documentado.
4. Pusher/Soketi en LAN está expuesto solo al rango privado; verificable con `system.status.view`.

## 10. Comandos de verificación

```bash
# Backend
docker exec s_hospital-backend-1 php artisan test --filter=Security
docker exec s_hospital-backend-1 php artisan test --filter=Audit
docker exec s_hospital-backend-1 php artisan test --filter=ReceiptPrintProfile
docker exec s_hospital-backend-1 php artisan test --filter=FiscalSequence

# Frontend
cd frontend && npm run lint
cd frontend && npm run typecheck
cd frontend && npm run test -- --reporter=verbose
cd frontend && npm run build

# a11y / e2e (si aplica)
cd frontend && npx playwright test --grep="a11y"
```

## 11. Actualizacion 2026-06-30

Cambios de seguridad verificados en esta iteracion:

- `receipt_settings.advanced` ahora viaja como permiso explicito al frontend para mostrar/ocultar soporte tecnico de impresion.
- La UI normal de recibos no renderiza inputs manuales de ancho, alto, margenes, fuente o escala.
- El backend sigue siendo la barrera real: `UpdateReceiptPrintProfileRequest` rechaza campos avanzados sin `receipt_settings.advanced` y registra `receipt_settings.advanced_denied`.
- El panel de facturacion conserva prevencion de doble submit y el boton principal ya no queda en un elemento fijo que pueda tapar errores o totales.
- Reportes de caja dejaron de exponer JSON tecnico en pantalla.

Pruebas ejecutadas:

- `php artisan test --filter=ReceiptPrintProfile` -> 3 tests OK.
- Suite critica frontend (`NewInvoiceViewLayout`, `NewInvoiceView`, `PaymentMethodPanel`, `ReportsView`, `InstitutionalReceiptSettingsView`, `AppShell`, `AppRoutes`) -> 37 tests OK.

Riesgos abiertos:

- Restauracion de backups sigue fuera de UI por diseno; no existe endpoint seguro implementado.
- Suite backend completa, Pint y PHPStan pasaron en esta iteracion.
- Falta validar headers de seguridad en runtime contra nginx/API levantados fuera del entorno de pruebas.

## 12. Cierre final 2026-07-01

### Comandos ejecutados

| Comando | Resultado |
|---|---|
| `rg "dangerouslySetInnerHTML|console\\.log|debugger|TODO|FIXME" frontend/src backend/app backend/routes backend/config` | Sin hallazgos operativos; solo `SystemStatusController` contiene la palabra `TODO` como detector de placeholders. |
| `rg "localStorage|password|token|stack trace|SQLSTATE" frontend/src backend/app backend/routes backend/config` | Hallazgos esperados en config, tests, auth y sanitizadores. No se encontro token de sesion guardado en `localStorage`. |
| `rg "Route::|middleware|can\\(|permission" backend/routes backend/app` | Endpoints API agrupados bajo auth/middleware/permisos. |
| `rg "audit|activity|AuditLog|activity\\(" backend/app backend/routes backend/tests` | Audit log presente en facturacion, pagos, caja, recibos, fiscal, catalogo, usuarios y respaldos. |
| `php artisan route:list` | OK, 112 rutas listadas. |
| `php artisan test` | OK, 744 passed, 12 skipped. |
| `php artisan test --filter=ReceiptPrintProfileAdvancedFieldsTest` | OK, 3 passed: sin advanced -> 403, con advanced -> guarda y audita, update basico permitido. |
| `php artisan test --filter=FiscalSequenceTest` | OK, 12 passed. |
| `php artisan test --filter=UpdateFiscalSequenceReasonTest` | OK, 2 passed. |
| `php artisan test --filter=CloseCashSessionTest` | OK, 3 passed. |

### Confirmaciones finales

- Endpoints sensibles: protegidos por `auth`, `user.active`, `password.changed`, permisos especificos y throttles por usuario.
- Motivo obligatorio: anular factura, reversar pago, cerrar caja con diferencia, cambiar precio, cambios fiscales criticos y cambios de roles/permisos.
- Audit log: acciones criticas registran before/after cuando aplica; respaldos, usuarios, caja, fiscal, catalogo, recibos y facturacion tienen eventos auditables.
- Campos manuales de impresion: backend rechaza `width_mm`, `height_mm`, `margin_*_mm`, `font_family`, `font_scale` sin `receipt_settings.advanced`.
- Restore de backups: no hay ruta ni boton operativo de restauracion. `backups.restore` no se siembra, se oculta si existe como legado y restaurar queda fuera hasta implementar permiso/flujo seguro con motivo minimo 20 caracteres, SHA256, backup previo automatico, bloqueo operativo y audit success/failure.
- Stack traces / SQL crudo: tests de seguridad validan que errores SQL no se exponen al usuario; grep solo encontro `SQLSTATE` en tests/sanitizacion.
- Logs de password/token: backups redactan password; login/change-password tienen tests que no ecoan password; no se encontro persistencia de token de sesion en frontend.

### Riesgos residuales de seguridad

- Headers finales deben validarse en el servidor LAN/nginx real despues del despliegue, porque esta fase corrio en entorno local de pruebas.
- `composer` no esta en PATH de esta terminal; los controles equivalentes se ejecutaron via `php artisan test`.
- No queda riesgo critico conocido en facturacion, caja, recibos, reportes, permisos o restore.

## 13. Cierre de verificacion 2026-07-01

Controles finales confirmados:

- `receipt_settings.advanced` gobierna la exposicion de campos manuales de impresion en frontend y backend.
- Los controles Radix de recibos tienen nombre accesible para evitar acciones anonimas en lectores de pantalla.
- Reportes eliminan color de bajo contraste en importes y conservan estructura de encabezado con un solo `h1`.
- Configuracion fiscal conserva sanitizacion de placeholders historicos antes de mostrar datos editables.
- `php artisan test` paso con 746 pruebas y 12 omitidas; despues de formatear `FiscalSettingsTest.php`, `php artisan test tests/Feature/FiscalSettingsTest.php` paso 13 pruebas.
- `vendor/bin/pint --test`, `vendor/bin/phpstan analyse`, `npm run lint`, `npm run test`, `npm run build` y `npm run visual:smoke` finalizaron OK.

## 14. Actualizacion 2026-07-05 - Caja local y auditoria de usuarios

Controles agregados/verificados:

- La apertura de caja usa una regla backend de una sola caja abierta global para la instalacion monocomputadora.
- `OpenCashSessionAction` serializa aperturas simultaneas con lock nombrado de MySQL/MariaDB antes de crear la sesion.
- La segunda apertura devuelve error funcional controlado; no crea movimiento de apertura ni auditoria duplicada.
- Desactivar usuarios sigue exigiendo motivo y el evento `user.deactivated` conserva ese motivo en `audit_logs.reason`.
- El frontend traduce errores `cash_session` como `Caja` para el operador, pero la defensa real permanece en backend.

Pruebas relevantes:

- `CashPaymentsReceiptTest` cubre apertura unica global y reapertura despues de cierre.
- `OpenCashSessionActionConcurrencyTest` cubre el lock nombrado y codigos de concurrencia DB.
- `InternalControlAuditTest` cubre motivo auditado al desactivar usuario.
- `CashBoxView.test.tsx` y `base.test.ts` cubren mensaje humano sin exponer `cash_session`.

## 15. Actualizacion 2026-07-05 - Respaldos sin nombres tecnicos en payload normal

Control agregado/verificado:

- El listado normal de respaldos ya no devuelve `filename`, `path`, `disk` ni `checksum_sha256`.
- El servidor conserva esos datos para descarga, integridad y auditoria interna; no se elimina evidencia tecnica necesaria.
- La descarga sigue validando archivo registrado, ruta segura, tamano y SHA256 antes de entregar el archivo.
- La UI genera un nombre de descarga humano desde fecha/id y no depende del nombre interno del archivo.

Pruebas relevantes:

- `BackupWorkflowTest` cubre listado sin detalles internos, descarga auditada, integridad alterada, path traversal y ausencia de endpoint restore.
- `BackupsView.test.tsx`, `useBackups.test.tsx` y `backups.test.ts` cubren contrato frontend sin `filename` operativo.

## 16. Actualizacion 2026-07-05 - Recibos normales con default institucional

Control agregado/verificado:

- El permiso `receipt_settings.advanced` ya no hace que el flujo normal de papel envie perfiles institucionales sin `is_global_default`.
- `Carta`, `Media carta` y `A5` se guardan como perfiles activos/default desde `Guardar perfil`, incluso para cuentas de soporte/admin.
- Los perfiles de soporte tecnico siguen separados y conservan sus banderas tecnicas dentro del modo soporte.

Pruebas relevantes:

- `InstitutionalReceiptSettingsView.test.tsx` cubre el caso con `canAdvancedPrintSettings=true` y panel avanzado cerrado.
- `npm run typecheck` y `npm run lint` verifican el cambio frontend sin errores.

## 17. Actualizacion 2026-07-05 - Reportes de auditoria requieren audit.view en UI

Control agregado/verificado:

- La subruta `/reports/audit` ya no se expone solo por `reports.managerial.view`.
- El frontend deriva `canViewAuditReports` desde `audit.view`, alineado con `/api/reports/operations` y `/api/system/audit-logs`.
- Si una cuenta gerencial sin auditoria intenta abrir `/reports/audit`, la pantalla cae a un reporte permitido en lugar de mostrar una vista que terminaria en 403.
- Una cuenta con solo `audit.view` puede entrar a Reportes y aterriza directamente en Auditoria.

Pruebas relevantes:

- `ReportsView.subroutes.test.tsx` cubre usuario gerencial sin `audit.view` y usuario audit-only.
- `ReportsAudit.test.tsx`, `npm run typecheck` y `npm run lint` verifican el cambio frontend.

## 18. Actualizacion 2026-07-05 - Catalogo envia motivo de disponibilidad

Control agregado/verificado:

- La desactivacion de servicios desde Catalogo exige motivo visible antes de confirmar.
- El frontend envia `availability_change_reason` junto con `active: false`, alineado con la validacion backend y auditoria de catalogo.
- La accion sigue sin borrar servicios ni tocar facturas historicas.

Pruebas relevantes:

- `CatalogView.test.tsx` cubre boton deshabilitado sin motivo y payload con `availability_change_reason`.
- `npm run typecheck` y `npm run lint` verifican el contrato TypeScript.

## 19. Actualizacion 2026-07-05 - Eritropoyetina bloqueada en edicion de catalogo

Control agregado/verificado:

- La edicion de un servicio existente con regla `ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION` bloquea precio, regla especial e ISV en el formulario.
- La UI conserva el alta asistida: al seleccionar eritropoyetina se fija L.25.00 y sin ISV, pero la seleccion puede corregirse antes de guardar.
- El control reduce cambios accidentales sobre campos regulados; la autoridad fiscal y de facturacion sigue estando en backend, snapshots historicos y validaciones server-side.

Pruebas relevantes:

- `ServiceSheet.test.tsx` cubre el bloqueo de regla/precio/ISV al editar eritropoyetina y la normalizacion al crear.
- `npm run typecheck` y `npm run lint` verifican el contrato frontend.

## 20. Actualizacion 2026-07-05 - Exports de reportes respetan audit.view

Control agregado/verificado:

- `/api/reports/export` y `/api/reports/pdf` ya no exponen secciones derivadas de auditoria operativa a usuarios sin `audit.view`.
- El XLSX conserva reportes financieros y hoja de cajeros, pero omite la hoja `Auditoria` sin permiso.
- El PDF de periodo conserva servicios/detalle operativo, pero omite resumen de auditoria, anulaciones, reimpresiones, reversos, cambios de catalogo y respaldos sin permiso.
- La respuesta JSON `/api/reports/operations` ya estaba protegida por `audit.view`; ahora los downloads quedan alineados con esa compuerta.

Pruebas relevantes:

- `ReportsTest` cubre export XLSX sin `audit.view`, PDF de periodo sin `audit.view`, y regresiones completas de reportes.
- `pint --test` y `phpstan analyse --memory-limit=512M` verifican formato y analisis estatico backend.

## 21. Actualizacion 2026-07-05 - Reporte ejecutivo respeta audit.view

Control agregado/verificado:

- El endpoint ejecutivo agrega `can_view_audit` y redacciona `voids_and_reversals`/`audit_summary` para usuarios sin `audit.view`.
- El PDF ejecutivo omite secciones de anulaciones/reversas y resumen de auditoria cuando el payload no autoriza auditoria.
- El XLSX ejecutivo omite las hojas `Anulaciones y reversas` y `Auditoria` sin `audit.view`, conservando resumen, cobros, servicios, cajeros, caja, pendientes y glosario.

Pruebas relevantes:

- `ExecutiveReportTest`, `ExecutivePdfExportTest` y `ExecutiveExcelExportTest` cubren redaccion sin `audit.view` y regresion completa con admin.
- `pint --test` y `phpstan analyse --memory-limit=512M` pasan.
