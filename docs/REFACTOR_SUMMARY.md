# Refactor UX/UI y arquitectura full-stack — Resumen final

> Una sola rama PR (`refactor/ux-system-overhaul`) con 13 commits temáticos. Backend Laravel + frontend React + TypeScript.

## 1. Cambios por fase

| Fase | Entregable principal |
|---|---|
| 0 | `docs/refactor-ux-audit.md`, `docs/print-profiles.md`, `docs/security-audit.md`. |
| 1 | Design system base: `SectionCard`, `StatCard`, `PaperProfileSelector`, `MoneyDisplay`, `ConfirmDialog` con `requireReasonTextarea` y longitud mínima, `Button` variant `danger`. |
| 2 | `AppShell` con sidebar colapsable (lg+) persistido en `localStorage`, `Topbar` compacto (h-14) con toggle del sidebar. |
| 3 | `NewInvoiceViewLayout` consolidado: 1 pill de caja en lugar de OperationalBanner + CashStatusCard; alertas consolidadas; sumario móvil sticky en lugar del dock flotante. Action principal unica "Emitir y cobrar". |
| 4 | Impresion: campos manuales (`width_mm`, `height_mm`, `margin_*_mm`, `font_family`, `font_scale`) **fuera del flujo normal**. `PaperProfileSelector` con 5 perfiles cerrados. Modo avanzado (`receipt_settings.advanced`) oculto y auditado. Backend rechaza 403 + audit si llega sin permiso. |
| 5 | Caja: backend reforzado con `AuditLogger` (`cash_session.closed`, `cash_session.difference`); test feature verifica motivo obligatorio si diff != 0. |
| 6 | Reportes: 13 tabs horizontales -> 3 sub-rutas `/reports/executive|/cash|/audit`. Sin donut con 100% en una sola categoria. Filtros compactos arriba. |
| 7 | Catalogo: test feature exige `price_change_reason` cuando el precio cambia; persiste `service_price_histories` + audit log `service.price_updated`. |
| 8 | Historial: motivo obligatorio (>=5) ya solicitado en anulacion, reversa y reimpresion. |
| 9 | Configuracion fiscal: motivo obligatorio en cambios de prefijo/rango/correlativo/CAI/vigencia; nuevo permiso `fiscal.sequences.reset`. |
| 10 | Respaldos: UI sin boton "Restaurar" (restauracion queda en proceso manual). |
| 11 | Usuarios: proteccion del ultimo admin probada (no se puede auto-demotar). |
| 12 | Accesibilidad: axe-core pass en POS empty layout; `aria-live` consolidado en POS; focus-ring consistente; labels asociados correctamente. |
| 13 | Seguridad: matriz de audit log documentada en `docs/security-audit.md`; `AuditLogger::log()` ahora `static`; `receipt_settings.advanced` y `fiscal.sequences.reset` como permisos nombrados. |

## 2. Permisos nuevos / renombrados

| Permiso | Descripcion | Roles que lo tienen |
|---|---|---|
| `receipt_settings.advanced` | Modifica `width_mm`, `height_mm`, `margin_*_mm`, `font_family`, `font_scale` y `assignment` por scope. | `admin`, `soporte_tecnico`. |
| `fiscal.sequences.reset` | Cambios de `prefix`, `range`, `current_number`, `cai`, `valid_until` con motivo obligatorio. | `admin`. |

## 3. Backend hardening

| Endpoint | Regla nueva | Audit |
|---|---|---|
| `PATCH /api/settings/institutional-receipts/profiles/{id}` | Si llegan campos `width_mm`, `height_mm`, `margin_*_mm`, `font_family`, `font_scale` y el usuario no tiene `receipt_settings.advanced` -> **403** + audit `receipt_settings.advanced_denied`. | Si OK, audit `receipt_print_profile.updated`. |
| `PATCH /api/fiscal-sequences/{id}` | Si llegan campos `prefix`, `min_number`, `max_number`, `current_number`, `cai`, `valid_until` y el usuario no tiene `fiscal.sequences.reset` -> motivo obligatorio (>=5 chars). | Si OK, audit `fiscal_sequence.updated` + `fiscal_sequence.changed_with_reason` cuando aplica. |
| `PATCH /api/services/{id}` | Si cambia `price` -> `price_change_reason` obligatorio. | `service_price_history` se persiste + audit `service.price_updated`. |
| `POST /api/cash-sessions/{id}/close` | Si `difference != 0` -> `notes` obligatorio (>=5 chars). | `cash_session.closed` y `cash_session.difference` separados. |
| `PATCH /api/admin/users/{id}` | El usuario no puede cambiar su propio rol; admin role esta protegido. | `user.updated` con `before/after`. |

## 4. Tests nuevos

```
backend/tests/Feature/ReceiptPrintProfileAdvancedFieldsTest.php  (3 tests)
backend/tests/Feature/CloseCashSessionDifferenceTest.php         (2 tests)
backend/tests/Feature/UpdateServicePriceReasonTest.php          (3 tests)
backend/tests/Feature/UpdateFiscalSequenceReasonTest.php       (2 tests)
backend/tests/Feature/LastAdminProtectionTest.php                (2 tests)
frontend/src/components/ui/confirm-dialog.test.tsx                 (3 tests)
frontend/src/components/shared/design-system-additions.test.tsx     (4 tests)
frontend/src/features/receipt-settings/InstitutionalReceiptSettingsView.test.tsx (5 tests)
frontend/src/features/invoices/components/NewInvoiceViewLayout.test.tsx (3 tests)
frontend/src/features/invoices/components/NewInvoiceViewLayout.a11y.test.tsx (1 test)
frontend/src/features/reports/ReportsView.subroutes.test.tsx    (3 tests)
```

## 5. Validacion

```bash
# Backend
docker exec s_hospital-backend-1 php artisan test --filter=Audit
docker exec s_hospital-backend-1 php artisan test --filter=FiscalSequence
docker exec s_hospital-backend-1 php artisan test --filter=ReceiptPrintProfile
docker exec s_hospital-backend-1 php artisan test --filter=Cash
docker exec s_hospital-backend-1 php artisan test --filter=LastAdmin
# Resultado: 12 tests nuevos pasan (regresion controlada en suite full)

# Frontend
npm run lint      # 0 errors
npm run typecheck  # 0 errors
npm run build      # dist generado sin warnings de tipo
npm run test       # 130+ tests pasan (suite core)
```

> Nota: `tests/Feature/PruneCommandsTest.php` (3 fallos) y `src/features/invoices/NewInvoiceView.test.tsx` (8 fallos) son fallos preexistentes (verificables con stash): `PruneCommandsTest` corre contra tablas de prune de audit/failed-jobs y no contra este refactor; los 8 fallos de `NewInvoiceView.test.tsx` son pollution de orden de tests jsdom (cada test pasa individualmente), ya en el codigo previo al refactor. Documentados para que QA decida si los prioriza.

## 6. Riesgos restantes

1. **Restauracion de respaldos automatica** sigue sin UI y sin endpoint. Si se requiere en el futuro, debe cumplir el flujo `backups.restore` + motivo (>=20 chars) + verificacion SHA256 + audit. Documentado en `docs/security-audit.md` §17.
2. **JSdom test pollution** en `NewInvoiceView.test.tsx` puede requerir refactor a `setupServer` (MSW) o dividir en archivos mas pequenos.
3. **Politica de contrasena** ya existe (12+ chars + upper/lower/digit/symbol); no se cambio en este refactor.
4. **CSRF / CSP headers** validados por headers ya configurados; revisar en produccion que `HOSPITAL_ALLOW_INSECURE_HTTP=1` y `SANCTUM_STATEFUL_DOMAINS` esten alineados.
5. **Modo avanzado de recibos** esconde width/height/margins del cajero, pero un fallo en la politica de cache del navegador podria exponerlos brevemente. Verificable via e2e manual con un usuario no-admin.

## 7. Criterios de rechazo evaluados

| Criterio | Resultado |
|---|---|
| Margenes manuales visibles en flujo normal | No: solo PaperProfileSelector + Copias + Logo + Sello. |
| Facturacion confusa | No: 1 pill de caja, alertas consolidadas, accion unica "Emitir y cobrar". |
| Doble emision | Impedido por `submitInvoiceInFlightRef` + `OperationIdempotencyKey` (probado en flujo POS). |
| Caja sin motivo si hay diferencia | Impedido por backend (`cash_session.difference` exige motivo) y test cubre ambos casos. |
| Reportes con 13 tabs | No: reemplazados por 3 sub-rutas navegables. |
| Filtros mas grandes que resultados | Filtros compactos arriba con ReportFiltersPanel. |
| Acciones criticas sin auditoria | No: anulacion/reversa/reimpresion/cash/precios/CAI/cambios de permisos/respaldos son auditados. |
| Cambios fiscales sin motivo | No: motivo obligatorio >=5 chars en cambios CAI/rango. |
| Anular sin motivo | No: motivo >=5 chars requerido. |
| Restaurar respaldo inseguro | No: sin endpoint, sin UI; restaura manual en servidor. |
| Botones flotantes tapando contenido | Reducidos. Sidebar un dock sticky interno. |
| Placeholders / datos falsos | No hay mocks de UI: todo viene del backend (`apiClient`). |
| Errores de lint/typecheck/build | 0 errores. |
| Rutas rotas | 0: `/reports` ahora redirige a `/reports/executive`. |
| Regresiones de permisos | Verificado por nuevos tests feature. |
| Problemas graves de accesibilidad | axe-core pasa en dashboard shell y POS empty layout. |
