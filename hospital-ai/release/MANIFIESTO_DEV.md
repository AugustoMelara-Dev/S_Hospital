# MANIFIESTO_DEV — fuentes y artefactos del producto nuevo

Entrega del punto 8 de `hospital-ai/MANDATO_DEV.md`: paquete/manifiesto
**reconstruible** de las fuentes y artefactos necesarios, **sin credenciales ni
datos reales**, con instrucciones de instalación/arranque.

- JSON canónico: `hospital-ai/release/MANIFIESTO_DEV.json`
- Sidecar de integridad: `hospital-ai/release/MANIFIESTO_DEV.json.sha256`
- Generador determinista: `scripts/generate_dev_manifest.ps1`

Este documento **no sustituye** al manifiesto histórico
`hospital-ai/release/MANIFIESTO_PRODUCTO.json` (campaña anterior), que se
conserva intacto y fuera del alcance del generador. Aquel describe un candidato
previo; este describe la reconstrucción vigente.

## Qué contiene y qué no

El manifiesto hashea por archivo (`ruta`, `bytes`, `sha256`, `categoria`), resume
por directorio (`archivos`, `bytes`, `hash_agregado`) y declara una lista curada
de archivos críticos.

Incluye:

- `frontend/src/**` y la configuración/lockfile/build del frontend.
- `backend/app/**`, `routes`, `config`, `database` (migraciones, seeders,
  factories), `resources/views`, `tests`, `public` y `bootstrap`.
- Migraciones nuevas `2026_09_18_*` (`settlement`, `rule_adjustment`, perfil de
  recibo) y `resources/views/pdf/institutional-receipts/compact.blade.php`.
- `scripts/**` (arranque, laboratorio no-Docker, LAN, respaldo/restauración,
  instalador) y `docker-compose*.yml` + `installer/S_Hospital.iss`.
- Documentos vivos (`MANDATO_DEV.md`, `MAPA_PRODUCTO.md`, `ESTADO_DEV.md`,
  `diseno/**`) y el `AGENTS.md`.

Excluye por construcción: `node_modules`, `vendor`, `.git`, `dist`, `build`,
`.pnpm-store`, `test-results`, `playwright-report`, `coverage`, `artifacts`,
`backend/storage`, `bootstrap/cache`, `hospital-ai/release` (evita
auto-referencia), `evidencia/progreso/r2`, `offline-release`,
`installer-output`, `backup-external`, `nginx/ssl`, **todo `.env*`** (incluidos
los `*.example`), logs, caches, material criptográfico (`*.pem`, `*.key`,
`*.p12`, `*.pfx`, `*.jks`), `package-lock.json` (lockfile npm legado: el canónico
es `pnpm-lock.yaml`) y `qa/screenshots`.

El generador escanea rutas y contenido contra patrones de secreto y **falla sin
escribir** si hay coincidencias. No se leen ni hashean datos operativos reales.

## Regenerar y verificar

```powershell
# Desde la raíz del worktree. No incluye fecha/hora: es determinista.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\generate_dev_manifest.ps1

# Verificar el sidecar
$side = (Get-Content hospital-ai\release\MANIFIESTO_DEV.json.sha256).Split(' ')[0]
(Get-FileHash hospital-ai\release\MANIFIESTO_DEV.json -Algorithm SHA256).Hash.ToLower() -eq $side
```

Corridas sobre los mismos bytes producen el mismo `sha256_manifiesto` y el mismo
JSON. El manifiesto es una **instantánea**, no una certificación: si un archivo
cambia, su hash deja de valer.

## Reconstruir

### Prerrequisitos reales

- **Ejecución (servidor LAN):** Windows 10/11/Server 64-bit o Linux; PHP 8.2+ con
  `pdo_mysql`, `mbstring`, `dom`/`xml`, `zip`, `gd`, `openssl`, `fileinfo`,
  `ctype`, `tokenizer`, `bcmath`; MariaDB 10.4+/MySQL 8 (laboratorio: MariaDB
  10.4.32; objetivo de despliegue: 11.4.3); Nginx o el servidor embebido de PHP.
- **Solo desarrollo/compilación:** Composer 2, Node.js 22 y pnpm 11.7.0 vía
  `corepack`. El cajero **no** compila: recibe el frontend ya construido.
- **Docker (objetivo):** Docker Desktop + Compose v2. Ver la advertencia de
  licencia en `SYSTEM_REQUIREMENTS.md`.

### Backend

```powershell
Set-Location backend
composer install --no-interaction
Copy-Item .env.example .env          # plantilla sin secretos; completar DB_* localmente
php artisan key:generate
php artisan migrate --seed --force   # idempotente; NUNCA migrate:fresh / db:wipe
php artisan serve --host=0.0.0.0 --port=8000
```

`DatabaseSeeder` es reproducible; `DevelopmentValidationSeeder` se autoexcluye
fuera de `local`/`testing`. No usar cuentas de validación en el hospital.

### Frontend

```powershell
Set-Location frontend
corepack enable
corepack prepare pnpm@11.7.0 --activate
corepack pnpm install --frozen-lockfile
corepack pnpm run build              # genera frontend/dist, que Laravel sirve
```

### Arranque en LAN sin internet

Laravel sirve la SPA desde `frontend/dist` (`backend/routes/web.php`), por lo que
basta un único origen. Con el backend ya en `0.0.0.0:8000`:

1. Fijar IP LAN del servidor (ej. `192.168.1.10`).
2. En `.env` (local, no versionado): `APP_URL=http://192.168.1.10:8000`,
   `SANCTUM_STATEFUL_DOMAINS=192.168.1.10:8000` y
   `CORS_ALLOWED_ORIGINS=http://192.168.1.10:8000`. En HTTP LAN controlada:
   `HOSPITAL_ALLOW_INSECURE_HTTP=1` y `SESSION_SECURE_COOKIE=false`.
3. Abrir el puerto 8000 en el firewall del servidor.
4. Clientes: `http://192.168.1.10:8000`. No exponer el puerto de MariaDB.

Todo (login, facturación, reportes, impresión) opera sin internet. Variables
requeridas por grupo: `APP_KEY`, `APP_URL`; `DB_*`; `SANCTUM_*`, `CORS_*`,
`SESSION_*`; `HOSPITAL_BACKUP_ENCRYPTION_KEY` y retenciones `HOSPITAL_*`;
`PUSHER_*`/`SOKETI_*` para eventos internos.

## Dos runtimes distintos (no confundir)

- **Laboratorio no-Docker actual (verificado en esta máquina):** MariaDB de
  XAMPP + PHP nativo + Vite, sobre base desechable `sh_ai_lab_local`.
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts\lab_local_up.ps1    # backend :18080, frontend :15173
  powershell -ExecutionPolicy Bypass -File scripts\lab_local_smoke.ps1
  powershell -ExecutionPolicy Bypass -File scripts\lab_local_down.ps1
  ```
  **No es paridad del despliegue Docker** (ver `hospital-ai/evidencia/C1-INST-01`).
- **Objetivo Docker (averiado en esta máquina):** WSL2/`docker-desktop`
  inutilizable y `com.docker.service` sin elevación. No destruir distribuciones,
  volúmenes ni imágenes ajenas. Cuando Docker esté sano:
  ```powershell
  Copy-Item .env.example .env   # y completar secretos locales
  docker compose up -d
  docker compose exec backend php artisan migrate --seed
  docker compose stop           # nunca `down -v` con datos a conservar
  ```
  Empaquetado offline: `scripts\make_offline_release.ps1` y
  `scripts\build_windows_installer.ps1` → `installer-output\ENTREGA-USB` →
  `setup.bat` / `S_Hospital-Instalador.exe`.

## Respaldos y restauración

El manifiesto no contiene datos ni respaldos. Respaldar/restaurar con
`scripts\restore_hospital_windows.ps1` y el runbook
`docs/backup-restore-runbook.md`: validar primero en base descartable y
conservar la clave `HOSPITAL_BACKUP_ENCRYPTION_KEY` fuera del servidor.

## Límites del paquete

- Solo rutas y hashes: **no incluye binarios, imágenes Docker, `vendor`,
  `node_modules` ni runtimes**.
- No promete un runtime listo: PHP, Node/pnpm (solo desarrollo), MariaDB y
  Docker se preparan por separado según prerrequisitos.
- No certifica instalación, impresora, segunda PC, zoom ni accesibilidad en el
  hospital: eso es **VALIDACIÓN EN EL HOSPITAL**.
- Los hashes valen para el instante de generación, no para un worktree en
  movimiento.
