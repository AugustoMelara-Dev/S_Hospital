# Matriz de Roles y Permisos Auditados (RBAC)

- **Sistema**: S_Hospital
- **Fecha**: 2026-07-22

## Matriz de Matriz Rol × Módulo × Permiso

| Rol | Módulo | Permisos Frontend | Autorización Backend (Policy/Gate) | Resultado Esperado | Resultado Observado |
| --- | --- | --- | --- | --- | --- |
| Administrador | Todos | Todos | `Gate::before` / Admin Policy | Acceso total | Autorizado 200 OK |
| Supervisor | Caja / Reportes / Respaldos | `cash.view`, `cash.close_any`, `reports.*`, `backups.view` | Policy check | Permite supervisar | Autorizado 200 OK |
| Cajero | Facturación / Caja / Historial | `invoices.create`, `cash.view`, `payments.create`, `receipts.view` | Policy check | Opera caja y emite facturas | Autorizado 200 OK |
| Soporte | Ayuda / Diagnóstico / Respaldos (Lectura) | `backups.view`, `system.status.view` | Policy check | Solo consulta diagnóstica | Rechaza 403 en creación |
