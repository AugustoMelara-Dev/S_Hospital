# System Requirements - Hospital Billing OS Offline

## Objetivo
Sistema para facturación hospitalaria local con caja, pagos, reportes, catálogo editable, usuarios, permisos, impresión térmica y backups.

## Stack
- Frontend: React + TypeScript.
- Backend: Laravel API.
- DB: MySQL/MariaDB.
- Auth: Laravel Sanctum.
- Permisos: Spatie Laravel Permission.
- Auditoría: Spatie Activitylog o tabla audit_logs propia.
- Backups: Spatie Backup o comandos mysqldump controlados.
- Formularios: React Hook Form + Zod.
- Server state: TanStack Query.
- Tablas: TanStack Table.
- Gráficos: Recharts.
- E2E: Playwright.

## Módulos obligatorios
Dashboard, facturación, catálogo, medicamentos/reglas, paciente simple, caja, pagos, facturas/historial, reportes, usuarios/permisos, configuración fiscal, impresión térmica/PDF, offline LAN, backups, auditoría.

## Regla del paciente
Solo nombre obligatorio. No implementar expediente clínico completo.

## Regla eritropoyetina
Medicamento de L.25. Gratis solo si se marca receta de diálisis.

## Offline
Sin internet en producción. Multiusuario por red local.
