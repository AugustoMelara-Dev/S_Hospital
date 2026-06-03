# Release notes - Sistema de Caja Hospitalaria v1.0.0

Fecha de release: 2026-06-02
Tag: `v1.0.0`
Estado: PRODUCTION_CANDIDATE
Branch base: `codex/audit-f1-config-hardening`

## Que incluye este release

Veinte fases de la auditoria 2026-06-02 + los 3 bloqueantes de
seguridad e infra (A1 secretos, A3 HTTPS, A4 CORS/SANCTUM) + 5
fases de hardening frontend (B1-B5) + 2 fases de hardening backend
(C2 CSP estricto, C5 phpstan nivel 5) + docker-compose.prod
endurecido (A5). Total: 14 commits pequenos, TDD donde aplica.

La decision final de `PRODUCTION_READY` sigue requiriendo las
pruebas fisicas B1-B6 (LAN, impresora, restore, concurrencia,
worker continuo, handoff) contra el hardware real. Las plantillas
y scripts ya estan listos.

## Metricas de calidad al cierre

- 340/340 tests PHPUnit backend
- 211/211 tests Vitest frontend
- 0 errores de typecheck
- 0 errores de ESLint
- 0 errores de phpstan nivel 5
- 28 warnings documentados para promover a error en v1.1
- Bundle gzipped: charts 116.73 kB (objetivo < 250 kB)

## Fases cerradas en este release

### Bloqueantes infra (A1-A5)

- **A1** `docs/SECRETS.md` con inventario, threat model, rotacion de
  APP_KEY y DB passwords, y pre-commit guard contract.
  `.env.example` y `backend/.env.example` sin defaults `hospital_dev`/
  `root_dev`. `scripts/pre-commit-guard.ps1` (8 tests) bloquea
  staged diffs con `APP_KEY=base64:`, `DB_PASSWORD=`,
  `DB_ROOT_PASSWORD=` no placeholder, y archivos en
  `offline-release/` fuera del allow-list.
- **A3** `scripts/generate_local_ca.ps1` con helper openssl
  (`scripts/lib/openssl_helpers.ps1`). Genera CA 4096-bit + cert
  de servidor 2048-bit. `nginx/default.conf` con bloque HTTPS
  comentado listo para activar. `docs/HTTPS_OPTIONAL.md` con
  procedimiento completo.
- **A4** `scripts/lib/cors_helpers.ps1` con `Get-ProductionCorsValues`
  y `Test-CorsOriginSafeForProduction`. deploy_hospital_lan.ps1 usa
  el helper en install y update flows. 17 tests cubren wildcard
  rejection, syntax validation, etc.
- **A5** `docker-compose.prod.yml`: `security_opt: no-new-privileges`
  en los 4 servicios, pin `nginx:1.25.4-alpine` y `mariadb:11.4.3`,
  mem/cpu/pids limits, MariaDB con `--max_connections=200` y
  `--skip-name-resolve`, `read_only` y `tmpfs` en nginx. Backend
  command corre `config:cache` y falla si `frontend/dist/index.html`
  esta vacio.

### Hardening frontend (B1-B5)

- **B1** TanStack Query invalidations tras `registerPayment`,
  `voidInvoice`, `reprintInvoice`, mutaciones de catalog.
- **B2** `CashBoxView` polls cada 10s con `refetchOnWindowFocus`.
  `useServerStatus` pausa polling en tab oculta.
- **B3** `lib/format/formatCurrency.ts` y test eliminados (dead).
  5 vistas migran a `formatLocalizedDateTime` compartido.
- **B4** `apiClient` con `AbortController` (10s/30s), Set de
  handlers de session expired con unsubscribe,
  `invalidateSession()` en logout. 5 tests nuevos.
- **B5** ESLint con `eslint-plugin-react-hooks` y
  `eslint-plugin-jsx-a11y`. 28 warnings documentados.

### Hardening backend (C2, C5)

- **C2** `AddSecurityHeaders` production CSP con nonce en style-src
  (sin `unsafe-inline`). 6 tests SecurityHeaders.
- **C5** phpstan nivel 5. Baseline regenerada (155 entradas,
  neto -613 lineas vs v1.0.0-rc.3).

## Evidencia fisica pendiente (B1-B6)

Para llegar a `PRODUCTION_READY` se requiere evidencia fisica contra
el hardware real. Las plantillas y scripts ya estan listos:

1. **B1** `qa/LAN_CLIENT_VALIDATION_PROOF.md`
2. **B2** `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md`
3. **B3** `qa/FINAL_RESTORE_PROOF.md`
4. **B4** `qa/FINAL_CONCURRENCY_PROOF.md`
5. **B5** `scripts/install_backup_tasks_windows.ps1`
6. **B6** `scripts/final_production_handoff.ps1`

## Comandos utiles

```powershell
# Regenerar paquete offline despues de cambios:
powershell -ExecutionPolicy Bypass -File scripts\make_offline_release.ps1 -Force
powershell -ExecutionPolicy Bypass -File scripts\assert_offline_release_clean.ps1 -RequireCurrentCommit

# Pref-rellenar plantillas de evidencia:
powershell -ExecutionPolicy Bypass -File scripts\init_production_proofs.ps1

# Preflight final (debe retornar 0 sin -AllowMissingPhysicalProof):
powershell -ExecutionPolicy Bypass -File scripts\production_readiness_preflight.ps1 -BaseUrl http://IP-SERVIDOR:8000

# Handoff guiado:
powershell -ExecutionPolicy Bypass -File scripts\final_production_handoff.ps1 -BaseUrl http://IP-SERVIDOR:8000 -PhpPath C:\xampp\php\php.exe -InitializeProofFiles

# Validar desde una PC cliente LAN:
powershell -ExecutionPolicy Bypass -File scripts\ping_lan_clients.ps1 -ServerUrl http://IP-SERVIDOR:8000 -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md

# Habilitar HTTPS opcional (una sola vez por hospital):
powershell -ExecutionPolicy Bypass -File scripts\generate_local_ca.ps1 -ServerIp 192.168.1.10
```

## Riesgos conocidos

- `NewInvoiceView` aun en ~490 lineas (objetivo <200 no alcanzado).
  El refactor a sub-reducers por paso esta diferido para v1.1.
- ESLint reglas `react-hooks/exhaustive-deps` y `jsx-a11y/*` a nivel
  warn en v1.0.0; se promueven a error en v1.1.
- `offline-release/offline-images/` requiere regeneracion con Docker
  antes de la primera instalacion LAN (paso de preflight).
- Sin HA: un unico servidor soporta todos los clientes LAN.
  Sin replica de lectura.
- `HOSPITAL_LICENSE_SALT` debe ser configurado explicitamente en
  produccion; el default embebido es solo para dev.

## Compatibilidad

- Windows 10 / 11 / Server 2019+ como servidor
- PowerShell 5.1+
- Docker Desktop o Docker Engine 24+
- MariaDB 11 o MySQL 8.0+
- Navegador: Chrome 120+, Edge 120+, Firefox 120+
- LAN: IPv4 fija recomendada
- HTTPS opcional: el cert autofirmado requiere instalar la CA en
  cada PC cliente (procedimiento en `docs/HTTPS_OPTIONAL.md`)
