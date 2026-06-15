# System Requirements - S_Hospital Offline

## Objetivo

Sistema institucional local para caja y facturacion hospitalaria con pagos, reportes, catalogo editable, usuarios, permisos, recibos institucionales en papel y respaldos.

## Stack

- Frontend: React + TypeScript.
- Backend: Laravel API.
- Base de datos: MySQL/MariaDB local.
- Auth: Laravel Sanctum.
- Permisos: Spatie Laravel Permission.
- Auditoria: Spatie Activitylog o tabla `audit_logs` propia.
- Backups: comandos locales controlados con MySQL/MariaDB dump.
- Formularios: React Hook Form + Zod.
- Server state: TanStack Query.
- Tablas: TanStack Table.
- Graficos: Recharts.
- E2E: Playwright.

## Modulos obligatorios

- Inicio/dashboard.
- Nueva factura.
- Caja.
- Pagos.
- Facturas e historial.
- Reimpresion.
- Catalogo de servicios.
- Usuarios y permisos.
- Configuracion fiscal/hospitalaria.
- Reportes.
- Respaldos.
- Auditoria.
- Offline LAN.

## Recibo institucional

El recibo operativo debe imprimirse en papel carta, media carta o A5. No debe ser ticket termico, no debe mostrar QR, codigo de barras ni codigos internos.

## Regla del paciente

Solo nombre obligatorio en factura. No implementar expediente clinico completo.

## Regla eritropoyetina

Medicamento de L.25. Gratis solo si se marca receta de dialisis.

## Offline LAN

Sin internet en produccion. Multiusuario por red local con una computadora servidor y clientes por navegador.
