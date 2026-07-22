# Matriz de Rutas y Navegación Auditadas

- **Sistema**: S_Hospital
- **Entorno de Verificación**: `http://127.0.0.1:8282`
- **Fecha**: 2026-07-22

## Inventario de Rutas Aplicación

| ID Ruta | Ruta URL | Módulo | Permisos Requeridos | Modo | Estado Auditado |
| --- | --- | --- | --- | --- | --- |
| `dashboard` | `/dashboard` | Inicio | Ninguno | Público Auth | Verificado / Corregido |
| `newInvoice` | `/billing/new` | Facturación | `invoices.create`, `catalog.view`, `cash.view`, `payments.create`, `receipts.view` | ALL | Verificado / Corregido |
| `cashbox` | `/cashbox` | Caja | `cash.view` | ALL | Verificado / Corregido |
| `catalog` | `/catalog` | Catálogo | `catalog.view` | ALL | Verificado |
| `invoices` | `/invoices` | Historial | `invoices.view` | ALL | Verificado |
| `reports` | `/reports` | Reportes | `reports.managerial.view`, `reports.cash_session.view`, `audit.view` | ANY | Verificado / Corregido |
| `backups` | `/backups` | Respaldos | `backups.view` | ALL | Verificado / Corregido |
| `fiscalSettings` | `/settings/fiscal` | Configuración | `settings.fiscal.view`, `settings.operational.update` | ANY | Verificado |
| `receiptSettings` | `/settings/institutional-receipts` | Recibos | `receipt_settings.view` | ALL | Verificado |
| `users` | `/admin/users` | Usuarios | `users.view` | ALL | Verificado |
| `help` | `/help` | Ayuda | Ninguno | Público Auth | Verificado |
| `support` | `/support` | Soporte | Ninguno | Público Auth | Verificado |
| `about` | `/about` | Acerca de | Ninguno | Público Auth | Verificado |
