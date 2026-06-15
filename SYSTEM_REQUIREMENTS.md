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

## Requisitos de hardware (subagente 16)

### Servidor (PC donde corre backend, frontend compilado, MySQL/MariaDB y backups)

**Minimos:**
- CPU: 4 nucleos x86_64 con virtualizacion habilitada.
- RAM: 8 GB DDR4.
- Disco: 100 GB SSD libres (sistema + codigo + base + backups locales + logs).
- Red: Gigabit Ethernet.
- Sistema operativo: Windows 10 Pro 22H2+, Windows Server 2019+, Ubuntu 22.04 LTS, Rocky Linux 9.

**Recomendados para produccion:**
- CPU: 8 nucleos.
- RAM: 16 GB DDR4.
- Disco: 250 GB SSD con volumen separado para backups.
- UPS con autonomia minima de 15 minutos.
- Doble NIC (LAN administrativa + LAN de caja) si el hospital separa redes.
- Windows Server 2022 Standard, Ubuntu 24.04 LTS o Rocky Linux 9.

### Estaciones de caja (clientes por navegador)

- CPU: 2 nucleos x86_64.
- RAM: 4 GB.
- Disco: 20 GB libres.
- Red: 100 Mbps Ethernet o Wi-Fi estable.
- Pantalla: 1366x768 minimo.
- Navegador soportado: Chrome 120+, Edge 120+, Firefox 120+ (soporte de `same-origin`, `fetch` con abort controller, `print` API).
- Teclado con bloque numerico para ingresos de pago.

### Impresora

- Impresora laser o inyeccion de tinta para los formatos carta, media carta horizontal, A5 horizontal o tamano personalizado del hospital.
- Driver instalado en la PC de caja que imprimira.
- Tamano personalizado configurado manualmente en Windows o Linux si la imprenta usa papel con dimensiones fisicas distintas a los estandares.
- Impresora compartida en red validada en cada cliente autorizado.

### Espacio en disco estimado (ano 1)

- Codigo backend + `vendor/`: 1.2 GB.
- Frontend compilado + assets: 50 MB.
- Base de datos (1 ano de operacion, 30 facturas/dia): 1 a 3 GB.
- Backups locales cifrados (retencion 30 dias): 10 a 30 GB.
- Logs operativos: 500 MB.
- Imagenes Docker precargadas (`offline-images/`): 800 MB.
- Margen de crecimiento: 50 GB.
- Total recomendado ano 1: 80 a 120 GB libres.

### Rutas recomendadas (referencia, no hardcodeadas)

- Instalacion: `C:\HospitalBilling` o `/opt/hospital`.
- Codigo backend: `C:\HospitalBilling\backend`.
- Frontend compilado: `C:\HospitalBilling\frontend\dist`.
- Volumen MySQL/MariaDB: `mysql_prod_data` (Docker) o `/var/lib/mysql`.
- Carpeta de backups locales: `C:\HospitalBilling\backups` o `/var/backups/hospital`.
- USB externo: `D:\` o `/mnt/usb` (copia periodica fuera del servidor).
- Logs: `backend/storage/logs/` y `install-logs/`.

### Procedimiento de reinstalacion

1. Copiar `offline-release/` a USB o carpeta temporal.
2. Ejecutar `setup.bat` (Windows) o `bash scripts/deploy_hospital_lan.sh` (Linux) como administrador.
3. El instalador detecta modo PHP local o Docker offline; restaura `.env` si existe backup del mismo.
4. Aplicar `php artisan migrate --force` (nunca `migrate:fresh`).
5. Importar ultimo backup `.sql.enc` con `restore_hospital_windows.ps1` en base descartable primero, luego a produccion solo si la base activa esta danada.
6. Validar `/up`, `/login`, `/verify-email`.

### Procedimiento de migracion a otra maquina

1. En la maquina origen, crear backup fresco y copiar el `.sql.enc` a USB.
2. Exportar `.env` real por canal seguro (no commitear, no email).
3. Instalar la misma version del sistema en la maquina destino con `setup.bat`.
4. Restaurar `.env` y backup `.sql.enc`.
5. Validar checksum y conteos minimos.
6. Documentar fecha, responsable, SHA256 y resultado en `qa/INCIDENT-YYYY-MM-DD.md`.
