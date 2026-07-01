# Refactor UX/UI y arquitectura — auditoría inicial

> Documento vivo. Su propósito es dejar constancia del estado observado del sistema S_Hospital antes del refactor y del plan acordado para reducir la sobrecarga cognitiva, asegurar operación real en hospital, y endurecer accesibilidad y seguridad.

## 1. Resumen ejecutivo

| | |
|---|---|
| Stack frontend | React 19 + TypeScript 5 + Vite 8 + Tailwind 4 (`@tailwindcss/vite`) + Radix UI + TanStack Query 5 + TanStack Table 8 + react-hook-form 7 + zod 4 + lucide-react + recharts 3 + react-to-print 3 + react-hot-toast + react-router 7 + laravel-echo + pusher-js |
| Stack backend | Laravel 12 (`^12.0`) sobre PHP 8.2 + Laravel Sanctum 4 + Spatie Laravel Permission 6 + barryvdh/laravel-dompdf 3 + phpoffice/phpspreadsheet 5 + pusher/pusher-php-server 7 |
| Persistencia | MySQL/MariaDB local en servidor LAN (sin internet) |
| Real-time | Soketi (Pusher-compatible) en LAN |
| Build artefact | `frontend/dist/index.html` pre-construido, servido por nginx |
| Tests frontend | Vitest 4 + Testing Library + axe-core + jsdom + Playwright |
| Tests backend | PHPUnit 11 |

## 2. Inventario de rutas

| Path | Vista | Permiso de entrada |
|---|---|---|
| `/dashboard` | `features/dashboard/DashboardView` | autenticado |
| `/billing/new` | `features/invoices/NewInvoiceView` (también en modal) | `invoices.create AND catalog.view AND cash.view AND payments.create AND receipts.view` |
| `/cashbox` | `features/cash/CashBoxView` (también en modal) | `cash.view` |
| `/catalog` | `features/catalog/CatalogView` | `catalog.view` |
| `/invoices` | `features/invoices/InvoiceHistoryView` | `invoices.view` |
| `/reports` | `features/reports/ReportsView` | `reports.view` o `reports.managerial.view` o `reports.cash_session.view` |
| `/backups` | `features/backups/BackupsView` | `backups.view` (+ `backups.create` para crear) |
| `/settings/fiscal` | `features/settings/FiscalSettingsView` | `settings.fiscal.view` |
| `/settings/institutional-receipts` | `features/receipt-settings/InstitutionalReceiptSettingsView` | `receipt_settings.view` |
| `/admin/users` | `features/admin/UsersView` | `users.view` |
| `/support`, `/help`, `/about` | centros de soporte, ayuda y acerca de | sin permiso |

## 3. Stack visual y deuda CSS

El sistema usa tokens personalizados a través de `src/styles.css`:

- Superficies: `--color-operational-{bg,surface,panel}`, `--color-hospital-{primary,accent,surface,panel,border}`.
- Sombras: `--shadow-operational`, `--shadow-panel`, `--shadow-command` (3 niveles).
- Estado: `--color-{success,warning,destructive,info}`.
- Sidebar: paleta propia (`--color-sidebar-*`).
- Tipografía: Geist (sans) + JetBrains Mono (mono).

Inconsistencias detectadas:

1. **Coexisten 2 anchos de la misma sombra** (`bg-operational-bg = #f8faf7`) y el sidebar usa `--color-sidebar` (#ffffff). No es bloqueante.
2. **Mezcla de sombras** (`shadow-operational`, `shadow-panel`, `shadow-command`) sin semántica clara de cuándo usar cada una.
3. **Variantes de border-success/warning/destructive** mezclan `/20`, `/30`, `/35`, `/40`. Se consolidan a un mapa.
4. **Sombras en dark mode** duplican lógica — se acepta.

## 4. Deuda UX/UI por vista

### `InstitutionalReceiptSettingsView` (`features/receipt-settings/InstitutionalReceiptSettingsView.tsx`, 752 líneas)

- Expone en flujo normal: ancho mm, alto mm, fuente, escala, márgenes superior/derecho/inferior/izquierdo (4 campos), más asignación por scope (`global|user|cash_session`).
- Estos campos son cosméticos y peligrosos: el CSS de impresión vive en `styles.css:552-621` con `@page receipt-*` fijos y media-print controlado, por lo que cualquier valor que el usuario escriba se ignora en la práctica.
- Tiene 4 tabs (`Institución`, `Serie`, `Papel`, `Vista previa`).
- Estadísticas redundantes arriba (`StatGrid` con `Perfil resuelto`, `Serie recibo`, `Copias`, `Modo`) que se podrían mover al ribbon superior.

### `FiscalSettingsView` (`features/settings/FiscalSettingsView.tsx`, 854 líneas)

- 4 tabs (`resumen`, `hospital`, `secuencia`, `branding`) que mezclan:
  - Datos del hospital.
  - `receipt_paper_size` (debería vivir solo en Recibos).
  - Escáner, abonos parciales (reglas operativas, no fiscales).
  - Logo + color de marca (branding).
  - CAI, prefijo, rango, numeración.
- `handleSaveColorTheme` reenvía **toda** `SettingsFormData` al servidor solo para cambiar el color → request inflada.

### `ReportsView` (`features/reports/ReportsView.tsx`, 896 líneas)

- **13 TabsTriggers** (`resumen, diario, mensual, rango, tendencia, métodos, servicios, cajeros, pendientes, anulaciones, auditoría, exportaciones, caja`).
- Gráficos:
  - `PaymentMethodPieChart` con donut — incorrecto si una categoría es 100%.
  - `TopServicesChart` con barras — sin leyenda clara.
  - `TrendChart` sin ejes legibles.
- Estado duplicado: `useState` para executive filters + `useState` para classic reports.

### `NewInvoiceView` + `NewInvoiceViewLayout` (`features/invoices/`, 650 + 390 líneas)

- `OperationalBanner` + `CashStatusCard` redundantes sobre el mismo hecho ("caja abierta/cerrada").
- 4 `<Alert>` simultáneos (`pointOfSaleLoadError`, `loadedCashSession`, `alertMessage`, `warningMessage`, `successMessage`) — sin `aria-live` consolidado.
- Dock flotante mobile (`fixed inset-x-0 bottom-0`) tapa la última fila del carrito cuando hay ítems.
- `selectAreaId === 'all'` cadena mágica.
- `submitInvoiceInFlightRef` + `submitPaymentInFlightRef` ya previenen doble-emisión pero no están probados explícitamente.

### `CatalogView` (`features/catalog/CatalogView.tsx`, 310 líneas)

- Hoja de servicio (`ServiceSheet`) tiene 7 validaciones con `border-destructive` repetido.
- Sin motivo obligatorio al cambiar precio (ya hay `ServicePriceHistory` pero el motivo es opcional).

### `InvoiceHistoryView` (`features/invoices/InvoiceHistoryView.tsx`, 670 líneas)

- Tabla densa, 5 acciones por fila, sin agrupar visualmente.
- Sin acción "Reimprimir" en 1 click desde resultado.

### `BackupsView` (`features/backups/BackupsView.tsx`, 827 líneas)

- 4 StatGrid + 4 cards de estado + checklist + pruebas de campo = sobrecarga.
- Sin acción "Restaurar" (bien) — pero deja al usuario sin saber qué hacer si la necesita.
- `friendlyProductionCheck` recorta etiquetas técnicas (`sanitizeTechnicalText`) — anti-confianza.

### `UsersView` (`features/admin/UsersView.tsx`, 1068 líneas)

- Un solo megacomponente con 4 dialogs simultáneos.
- Permisos en strings técnicos (`catalog.view`, `invoices.create`) no agrupados por módulo para el usuario final.

### `DashboardView` (`features/dashboard/DashboardView.tsx`, 275 líneas)

- `CashStatusCard` + `InfoPanel` sobre el mismo hecho.
- 3 cards en grid de 2-3 para métricas (`DashboardMetricsGrid`) — bien, pero el "SetUp status card" agrega otra fila.

### `CashBoxView` (`features/cash/CashBoxView.tsx`, 357 líneas)

- Layout bien estructurado, pero con muchas cards apiladas.
- El `CloseSessionDialog` ya exige motivo si `difference != 0` → en backend (`CloseCashSessionAction`). Falta hacer esto explícito en UI.

## 5. Deuda de seguridad

| Tema | Estado | Acción |
|---|---|---|
| Audit log | Sí, vía `Spatie Activitylog` + `audit_logs` | Centralizar helper `AuditLogger::record()` |
| Idempotencia | `OperationIdempotencyKey` con TTL | Verificar uso en todas las mutaciones |
| Permisos backend | `Spatie Permission` + `RoleCatalog` | Añadir `receipt_settings.advanced`, `fiscal.sequences.reset`, `backups.restore` |
| Sanitización | `OperationalMessageSanitizer` + escape en backend | Asegurar pacientes y servicios sin HTML/scripts |
| Restauración de backups | **Sin endpoint seguro hoy** | Dejar `restore` no disponible hasta tener SHA256 + motivo |
| Sesiones | LoginAttempt con lockout 5/15min | Confirmar en test |
| CSRF/Sanctum | `apiClient` con `csrf.ts` | Confirmar tests |
| Headers (CSP, X-Frame-Options) | Report-only vía middleware | Reforzar |

## 6. Deuda de accesibilidad

- `AppShell` ya tiene skip-link (`a[href="#main-content"]`) y `<main tabIndex={-1}>` con focus-ring.
- `Button`, `Dialog`, `ConfirmDialog` Radix-built → focus trap OK.
- Tests axe-core presentes (`v1-2-visible-ui-a11y.spec.ts`).
- Pendientes:
  - 4 `<Alert>` simultáneos en `NewInvoiceViewLayout` sin `aria-live`.
  - Color único como señal en `PaymentMethodPanel` (donut) y `AuditSummaryPanel`.
  - Dock flotante mobile sin `aria-controls`.
  - `aria-orientation` ausente en tablist de `ReportsView`.

## 7. Riesgos críticos de facturación y recibos

1. **Impresión insegura por diseño:** los inputs manuales de `InstitutionalReceiptSettingsView` son inertes pero confían al usuario que está controlando algo. Cualquier cambio queda en BD y se **ignora** en la práctica.
2. **Cambio de `receipt_paper_size` en `FiscalSettingsView`:** si el operador cambia de media carta a ticket 80mm en medio del turno, las facturas en cola usarán perfil distinto. Esto se valida en backend con `FiscalSetting`, pero la UI no avisa del impacto.
3. **Doble emisión** mitigado con `submitInvoiceInFlightRef` + `OperationIdempotencyKey`. Falta prueba explícita.
4. **`receipts.print_test`** debe estar siempre en modo prueba — la marca `PRUEBA - SIN VALIDEZ` debe ser visible y el endpoint PHP ya devuelve `X-Receipt-Test-Print: PRUEBA - SIN VALIDEZ`.

## 8. Plan de implementación por fases

| Fase | Entregable |
|---|---|
| FASE 0 | Este documento + `print-profiles.md` + `security-audit.md` |
| FASE 1 | Tokens y componentes base (`SectionCard`, `PaperProfileSelector`, `StatCard`, `ConfirmDialog` con motivo, `Button` variant danger, `StatusBadge` consolidado) |
| FASE 2 | Sidebar colapsable + Topbar compacto + breadcrumb discreto |
| FASE 3 | Nueva Factura simplificada |
| FASE 4 | Impresión y perfiles: eliminar inputs manuales del flujo normal, `PaperProfileSelector`, modo avanzado con permiso `receipt_settings.advanced` |
| FASE 5 | Caja y cierre guiado |
| FASE 6 | Reportes en 3 sub-rutas (ejecutivo, caja, auditoría) |
| FASE 7 | Catálogo compacto, motivo en cambio de precio |
| FASE 8 | Historial con búsqueda rápida y reimprimir 1 click |
| FASE 9 | Configuración fiscal separada (Institución, Numeración, Operaciones, Branding) |
| FASE 10 | Respaldos compactos; `restore` documentado pero no disponible por seguridad |
| FASE 11 | Usuarios: sub-rutas users + roles; matriz de permisos agrupados |
| FASE 12 | Accesibilidad transversal (aria-live, focus, contrast) |
| FASE 13 | Seguridad: helper `AuditLogger`, permisos nuevos, `restore` backend si se implementa |
| FASE 14 | Limpieza global, screenshots, build, reporte final |

## 9. Criterios de aceptación transversales

- Una factura simple con teclado en <60 s.
- No doble-emisión (probado).
- No exponer márgenes/fuentes en flujo normal.
- Diferencia de caja con motivo obligatorio.
- Cambios fiscales con motivo y audit.
- Reportes con máximo 3 sub-rutas y sin charts inútiles.
- Botones flotantes que tapan contenido eliminados.
- axe-core sin violaciones graves.
- `lint`, `typecheck`, `tests`, `build` verdes al final.

## 10. Out of scope

- Migrar a Next.js (no aporta offline LAN).
- Sustituir MySQL/MariaDB.
- Quitar `Spatie Permission` (es la fuente de permisos actual).
- Reescribir DomPDF por otro motor (mantener `barryvdh/laravel-dompdf`).

## 11. Actualizacion 2026-06-30

Cambios aplicados en esta iteracion:

- Se restauro el `AppShell` con sidebar compacto/colapsable y persistencia local no sensible (`s-hospital-sidebar-collapsed`).
- Se elimino el dock fijo inferior en `NewInvoiceViewLayout`; la accion principal queda dentro del carrito para no tapar servicios, totales ni alertas en movil.
- `ReportsView` mantiene 3 secciones navegables: Ejecutivo, Caja y Auditoria. Se retiraron tarjetas de caja con valores inventados y un bloque JSON tecnico.
- `PaymentMethodPanel` dejo de usar donut y ahora muestra barras horizontales + tabla accesible.
- `InstitutionalReceiptSettingsView` recibe explicitamente `canAdvancedPrintSettings`; los campos manuales de ancho, alto, margenes, fuente y escala solo aparecen con permiso `receipt_settings.advanced` y dentro del panel de soporte tecnico.
- La UI normal de recibos ya no muestra medidas en mm como parte de la operacion diaria; solo muestra papel, copias, logo, sello/firma, prueba y guardar.

Riesgos aun abiertos:

- Hay documentos y textos fuente con mojibake historico (`CatÃ¡logo`, `ConfiguraciÃ³n`). No se normalizo de forma masiva para evitar churn fuera del alcance inmediato.
- La verificacion visual final depende de levantar Vite/API con datos de sesion disponibles.
- Reportes de caja requieren ingresar una caja concreta; aun no hay listado compacto de sesiones recientes en esta iteracion.
