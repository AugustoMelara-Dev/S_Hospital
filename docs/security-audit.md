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
- `backups.restore` — supervisor/admin (UI actualmente no expone esta acción por seguridad).
- `receipt_settings.advanced` — soporte (nuevo en este refactor) — desbloquea los 8 campos manuales de impresión.
- `fiscal.sequences.reset` — admin (nuevo) — para reiniciar correlativo fiscal cuando no hay facturas emitidas.
- `settings.fiscal.update`, `receipts.void`, `invoices.reverse`, `payments.void`, `cash.close_any`, `invoices.operate_any` — supervisor/admin (consolidado en `RoleCatalog::ELEVATED_ROLE_PERMISSIONS`).

## 2. Matriz de acciones críticas

Leyenda:
- **A** = audit log obligatorio (`audit_logs`).
- **M** = motivo obligatorio (textarea, longitud mínima `5` caracteres, max `500`).
- **I** = idempotencia verificada vía `OperationIdempotencyKey`.
- **P** = permiso específico del backend.

| # | Acción | Endpoint | Permiso | A | M | I | Validaciones extra |
|---|---|---|---|---|---|---|---|
| 1 | Login OK | `POST /api/auth/login` | público | sí | – | – | lockout 5/15 min (`LoginAttempt`), CSRF |
| 2 | Login FAIL | `POST /api/auth/login` | público | sí | – | – | lockout, motivo adicional si está bloqueado |
| 3 | Crear factura | `POST /api/billing/invoices` | `invoices.create` | sí | – | sí | paciente no vacío, 1+ items, cantidades > 0, precios snapshot |
| 4 | Anular factura | `POST /api/billing/invoices/{id}/void` | `invoices.void` | sí | sí (≥5) | sí | factura no anulada previamente, no pagada totalmente |
| 5 | Reversar pago | `POST /api/payments/{id}/reverse` | `payments.void` | sí | sí (≥5) | sí | pago no reversado, factura activa |
| 6 | Crear pago | `POST /api/cash-sessions/{id}/payments` | `payments.create` | sí | – | sí | caja abierta, factura existe, balance disponible |
| 7 | Abrir caja | `POST /api/cash-sessions` | `cash.open` | sí | – | – | sin caja abierta del mismo usuario |
| 8 | Cerrar caja | `POST /api/cash-sessions/{id}/close` | `cash.close` | sí | sí si diff≠0 | sí | efectivo contado numérico, sin facturas pendientes |
| 9 | Diferencia de caja | (auto al cerrar) | – | sí | sí | – | se registra `cash_session.difference` además del cierre |
| 10 | Cambiar precio de servicio | `PUT /api/catalog/services/{id}` | `catalog.manage` | sí | sí (≥5) | – | precio anterior → `service_price_history` |
| 11 | Cambiar perfil impresión (básico) | `PUT /api/receipts/profiles/{id}` | `receipt_settings.update` | sí | – | – | no permite los 8 campos manuales sin `receipt_settings.advanced` |
| 12 | Cambiar perfil impresión (avanzado) | `PUT /api/receipts/profiles/{id}` | `receipt_settings.advanced` | sí | – | – | cualquier campo manual exige el permiso; sin él → 403 + audit |
| 13 | Cambiar CAI / rango / prefijo | `PUT /api/fiscal/sequences/{id}` | `settings.fiscal.update` | sí | sí (≥10) | – | no reiniciar `current_number` sin `fiscal.sequences.reset` |
| 14 | Resetear correlativo fiscal | `PUT /api/fiscal/sequences/{id}/reset` | `fiscal.sequences.reset` | sí | sí (≥20) | – | exige que no haya facturas emitidas con ese correlativo, o motivo documentado si las hay |
| 15 | Crear respaldo | `POST /api/backups` | `backups.create` | sí | – | – | storage disponible |
| 16 | Descargar respaldo | `GET /api/backups/{id}/download` | `backups.download` | sí | – | – | – |
| 17 | Restaurar respaldo | `POST /api/backups/{id}/restore` | `backups.restore` | **no implementado** | – | – | ver §3 |
| 18 | Crear usuario | `POST /api/admin/users` | `users.create` | sí | – | – | password policy (12+ chars, upper/lower/digit/symbol) |
| 19 | Actualizar usuario | `PUT /api/admin/users/{id}` | `users.update` | sí | sí si cambia rol | – | impide auto-demote del último admin |
| 20 | Cambiar rol | (subconjunto de update) | `users.update` | sí | sí | – | impide quitar todos los admin |
| 21 | Cambiar permisos directos | `PUT /api/admin/users/{id}/permissions` | `users.assign_admin_role` si son reservados | sí | – | – | separa reservados/elevados vía `RoleCatalog` |
| 22 | Crear/editar rol | `POST/PUT /api/admin/roles` | `users.assign_admin_role` | sí | – | – | rechazar nombre `admin`/`root` |

## 3. Restauración de respaldos — **no disponible en UI**

> El backend actual **no** expone un endpoint de restauración seguro. La regla es:
> "Restaurar un respaldo sobre datos reales sin confirmar integridad, motivo y respaldo previo es una bomba de tiempo."

### Estado actual

- `POST /api/backups/{id}/restore` → **no implementado** (no aparece en rutas).
- La UI de Respaldos **no** muestra botón "Restaurar" — intencional.
- El descargable sí está disponible (`GET /api/backups/{id}/download`) con audit.

### Restricciones para implementación futura

Si en el futuro se requiere restaurar desde la app, el flujo será:

1. Permiso `backups.restore`.
2. Verificación de integridad SHA256 del archivo.
3. Confirmación visual con `ConfirmDialog` que exige motivo ≥ 20 caracteres.
4. Bloqueo de la app durante la operación.
5. Backup automático **previo** a la restauración.
6. Audit log con `action="backup.restored"` + antes/después del checksum.
7. Rate limit por usuario/equipo.

Hasta entonces, **la restauración se hace desde el servidor** por personal autorizado fuera de la app.

## 4. Validaciones de backend obligatorias

### 4.1 Doble emisión

- `POST /api/billing/invoices` requiere `OperationIdempotencyKey` válido (TTL 24h).
- Doble click del mismo operador en la UI con la misma idempotency-key → `409 Conflict` con cuerpo claro.
- El frontend genera y guarda el key con `createClientIdempotencyKey()`.

### 4.2 Anti-XSS en nombres

- Backend: `strip_tags` + `mb_convert_encoding` en `patient_name` y `service_name` antes de persistir.
- Frontend: renderiza con texto plano; nunca `dangerouslySetInnerHTML`.

### 4.3 Estados de documento

- `Invoice`, `Payment`, `InstitutionalReceipt`, `CashRegisterSession` tienen transiciones de estado controladas vía Actions; no se actualizan con `fill()` directo.

### 4.4 Idempotencia

Todas las mutaciones críticas (`invoices.create`, `invoices.void`, `payments.create`, `payments.void`, `cash.open`, `cash.close`, `receipts.print`, `backups.create`, etc.) usan `OperationIdempotencyKey`.

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
- Restore de backups: no hay ruta ni boton operativo de restauracion. Restaurar queda fuera hasta implementar permiso `backups.restore`, motivo minimo 20 caracteres, SHA256, backup previo automatico, bloqueo operativo y audit success/failure.
- Stack traces / SQL crudo: tests de seguridad validan que errores SQL no se exponen al usuario; grep solo encontro `SQLSTATE` en tests/sanitizacion.
- Logs de password/token: backups redactan password; login/change-password tienen tests que no ecoan password; no se encontro persistencia de token de sesion en frontend.

### Riesgos residuales de seguridad

- Headers finales deben validarse en el servidor LAN/nginx real despues del despliegue, porque esta fase corrio en entorno local de pruebas.
- `composer` no esta en PATH de esta terminal; los controles equivalentes se ejecutaron via `php artisan test`.
- No queda riesgo critico conocido en facturacion, caja, recibos, reportes, permisos o restore.
