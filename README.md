# S_Hospital v2

Sistema de **caja hospitalaria** para redes locales sin internet: facturación con numeración
fiscal CAI (Honduras), cobros, caja por turnos con arqueo, recibos institucionales en PDF,
catálogo de servicios, reportes, usuarios y roles, auditoría y respaldos cifrados.

Un servidor en la LAN ejecuta la aplicación y la base de datos; las computadoras de caja
solo necesitan un navegador (`http://<IP-del-servidor>:8080`).

> v2 es una reescritura completa de la versión 1 (PHP/Laravel). La v1 se conserva en la rama
> `release/entrega-20261021`.

## Módulos

| Módulo | Qué hace |
|---|---|
| **Cobrar** | Punto de venta por teclado: paciente, búsqueda de conceptos, cantidades, totales calculados por el servidor, cobro en efectivo/tarjeta/transferencia con cambio, recibo automático. |
| **Recibos** | Historial de operaciones, detalle, reimpresión con motivo, cobro de saldo, anulación y reversión auditadas. |
| **Caja** | Apertura, movimientos, arqueo por denominaciones (L 500 a L 1), cierre con diferencia justificada, histórico y resumen PDF. |
| **Resumen** | Indicadores del día, cobros por método, pendientes que requieren atención. |
| **Reportes** | Periodos de hasta 92 días con filtros; operaciones, detalle, cobros, caja y gratuidades; exportación PDF y Excel. |
| **Catálogo y precios** | Conceptos, categorías y áreas; historial de precios; impuesto en lote; importar/exportar CSV y Excel. |
| **Usuarios y permisos** | Usuarios, roles personalizables con 32 permisos, cambio de clave obligatorio, bloqueo por intentos fallidos. |
| **Ajustes institucionales** | Identidad del hospital y logo, numeración fiscal CAI, tasas de ISV, abonos parciales, perfiles de impresión y serie de recibos. |
| **Respaldos y auditoría** | Respaldo diario automático cifrado (AES-256-GCM) y manual; bitácora inmutable de acciones sensibles. |

### Reglas de negocio clave

- El **servidor decide los totales**. Todo el dinero se maneja en centavos enteros, nunca en flotantes.
- **ISV** por grupo de tasa con redondeo comercial; los centavos se reparten por mayor residuo para que la suma de las líneas cuadre siempre con el total.
- **Eritropoyetina**: con receta de diálisis queda sin cobro solo la línea del medicamento elegible. El resto de la cuenta se cobra normalmente.
- Las facturas **nunca se borran**: se anulan o revierten, siempre con permiso, motivo y auditoría. Guardan una copia de precios, nombres y datos fiscales del momento de emisión.
- El recibo institucional sale en carta, media carta, A5 o A4, sin QR, códigos de barras ni códigos internos.

## Arquitectura

```
api/   Python 3.12 · FastAPI · SQLAlchemy 2 · Alembic · ReportLab · openpyxl
web/   React 19 · TypeScript · Vite · TanStack Query · React Hook Form + Zod · Tailwind 4
docs/  SPEC.md (contrato API + reglas) · TERMINOLOGIA.md (textos y flujos de pantalla)
```

- Base de datos: **MariaDB 11 / MySQL 8** en producción. SQLite solo se usa en desarrollo y pruebas.
- Un solo proceso sirve la API (`/api`) y el SPA compilado (`/`). No hace falta nginx ni internet.
- Sesión por cookie httpOnly, protección CSRF por cabecera y escrituras idempotentes (`Idempotency-Key`), para que un doble clic o un reintento nunca dupliquen un cobro.

## Instalación en servidor (Docker)

Requisitos: Docker con Compose.

```bash
cp .env.example .env
```

Edite `.env`: contraseñas de BD, `SHS_SECRET_KEY`, `SHS_BACKUP_KEY` y la clave del primer administrador.

```bash
docker compose up -d --build
```

- Abra `http://<IP-del-servidor>:8080` e ingrese con el administrador definido en `.env`. Se le pedirá cambiar la clave.
- En **Administración → Ajustes institucionales**, registre el nombre, el RTN y la **numeración fiscal (CAI)** antes de facturar.
- Guarde `SHS_BACKUP_KEY` fuera del servidor. Sin ella los respaldos no se pueden descifrar.

Para una demostración con datos de prueba use `SHS_SEED_DEMO=true`. Los usuarios `admin`, `supervisor`, `cajero` y `auditor` tienen la clave `Hospital#2026`. **Nunca lo use en producción.**

## Desarrollo (Windows)

Este script crea el venv, instala dependencias, migra, siembra la demo y abre la API (:8000) y Vite (:5173):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\dev.ps1
```

Manual:

```powershell
cd api;  python -m venv .venv; .venv\Scripts\pip install -r requirements-dev.txt
.venv\Scripts\python -m app.cli migrate; .venv\Scripts\python -m app.cli seed --demo
.venv\Scripts\python -m app.cli serve --reload
cd ..\web; npm ci; npm run dev
```

Documentación interactiva de la API: `http://localhost:8000/api/docs`.

## Pruebas y calidad

```powershell
cd api; .venv\Scripts\python -m pytest; .venv\Scripts\ruff check .
cd web; npm run typecheck; npm run lint; npm run test; npm run build
cd web; npm run e2e      # Playwright contra la API real (ver web/README.md)
```

La integración continua (`.github/workflows/ci.yml`) ejecuta:

- lint y pruebas de la API;
- migraciones y semilla sobre **MariaDB real**;
- las compuertas del frontend;
- la construcción de la imagen Docker.

## Respaldos

- **Automáticos**: a diario a la hora `SHS_DAILY_BACKUP_TIME`. Se guardan en el volumen `app_data`, carpeta `/data/backups`.
- **Manuales**: en *Administración → Respaldos*.
- Cada archivo `.enc` va comprimido y cifrado con AES-256-GCM, y su SHA-256 queda registrado.
- **Restaurar** (soporte técnico): el comando descifra el respaldo a un `.sql` o `.db` sin tocar la base de datos en uso.

```bash
docker compose exec app python -m app.services.backups restore /data/backups/<archivo>.enc --out /data/restore
```

Después importe el `.sql` con `mariadb` en una ventana de mantenimiento.

## Licencia

Software propietario. Consulte [LICENSE](LICENSE).
