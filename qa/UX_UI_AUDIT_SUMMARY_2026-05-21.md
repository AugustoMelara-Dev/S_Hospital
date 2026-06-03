# Auditoria UX/UI - 2026-05-21

## Alcance verificado

- Login
- Inicio
- Nueva factura
- Caja
- Catalogo
- Historial de facturas
- Reportes
- Respaldos
- Configuracion fiscal
- Usuarios
- Ayuda

## Evidencia visual

Capturas actuales:

- `qa/screenshots/ux-cleanup-2026-05-21-browser/login.png`
- `qa/screenshots/ux-cleanup-2026-05-21-browser/dashboard.png`
- `qa/screenshots/ux-cleanup-2026-05-21-browser/billing-new.png`
- `qa/screenshots/ux-cleanup-2026-05-21-browser/cashbox.png`
- `qa/screenshots/ux-cleanup-2026-05-21-browser/catalog.png`
- `qa/screenshots/ux-cleanup-2026-05-21-browser/invoices.png`
- `qa/screenshots/ux-cleanup-2026-05-21-browser/reports.png`
- `qa/screenshots/ux-cleanup-2026-05-21-browser/backups.png`
- `qa/screenshots/ux-cleanup-2026-05-21-browser/settings-fiscal.png`
- `qa/screenshots/ux-cleanup-2026-05-21-browser/users.png`
- `qa/screenshots/ux-cleanup-2026-05-21-browser/help.png`
- `qa/screenshots/ux-cleanup-2026-05-21-browser/dashboard-user-menu.png`

Pruebas de navegador guardadas:

- `qa/screenshots/ux-cleanup-2026-05-21-browser/ux-cleanup-browser-report.json`
- `qa/screenshots/ux-cleanup-2026-05-21-browser/interaction-proof.json`
- `qa/screenshots/ux-cleanup-2026-05-21-browser/settled-screens-proof.json`
- `qa/screenshots/ux-cleanup-2026-05-21-browser/login-proof.json`

## Hallazgos corregidos

- Logout duplicado: queda una sola accion de cierre de sesion en el menu de usuario.
- Navegacion: sidebar con modulos claros y ruta `/admin/users` servida por la SPA.
- Conceptos tecnicos visibles: removidos o traducidos en respaldos, reportes, shell y login.
- Reportes PDF: ya no muestran `S_Hospital` ni "Copias de Seguridad (Backups)".
- Configuracion fiscal: el nombre del hospital es editable y se refleja en login, topbar, sidebar y resumen fiscal.
- Accesibilidad textual: se corrigieron etiquetas/ARIA con acentos y nombres de acciones.
- Tooltip LAN: ya no muestra `undefined` cuando aun no hay ultima revision.

## Evidencia automatizada

Comandos ejecutados correctamente:

- `npm.cmd run test`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`
- `php artisan test --colors=never --filter=BackupWorkflowTest`
- `php artisan test --colors=never --filter=ReportsTest`
- `php artisan test --colors=never --filter=ProductionSpaRouteTest`

## Riesgos restantes

- Vite conserva una advertencia no bloqueante por un chunk apenas mayor a 500 kB.
- El worktree incluye cambios de hardening/produccion previos que deben separarse con cuidado al preparar commit o PR.
- Hay archivos generados/no versionados fuera del alcance UX que conviene revisar antes de cualquier `git add` amplio.
