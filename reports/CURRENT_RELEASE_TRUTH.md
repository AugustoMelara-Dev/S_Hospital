# Current Release Truth — S_Hospital

> **Fuente canónica única de estado del release (vigente desde 2026-09-17;
> refrescada con los hechos verificados de wave 2).** Este documento NO declara
> certificación, NO promueve artefactos y NO edita `RESULT.json`/`PASSED`.
> Sustituye al estado canónico de la campaña T2 (2026-09-13), conservado bajo
> **Histórico**. Mandato vigente: `hospital-ai/MANDATO_DEFINITIVO.md` §24
> (estados) y §20 (matriz de aceptación). Matriz §20 vigente:
> `hospital-ai/progreso/MATRIZ_ACEPTACION.md`; tablero:
> `hospital-ai/progreso/TABLERO_MANDATO.md`.

## 1. Identidad del workspace y revisión

| Campo | Valor verificado |
|---|---|
| Raíz escribible | `C:\Projects\S_Hospital_AI` (worktree aislado, detached) |
| Origen intocable | `C:\Projects\S_Hospital` (`source_repo` en `hospital-ai/WORKSPACE.json`) |
| HEAD | `baa41f97310a578f8fd417a1e9b4b5d06c380670` |
| Rama | sin rama (detached); `git branch --show-current` devuelve vacío |
| Commits creados en la campaña | 0 (sin commit/push/reset/clean) |
| Árbol de trabajo | sucio por diseño (ver §2) |
| Modelo de sesión | `opencode-go/deepseek-v4.1-flash` |
| Mandato vigente | `hospital-ai/MANDATO_DEFINITIVO.md` (§23, §24) |
| Matriz §20 vigente | `hospital-ai/progreso/MATRIZ_ACEPTACION.md` |
| Tablero | `hospital-ai/progreso/TABLERO_MANDATO.md` |

Comando de comprobación y salida cruda:
`hospital-ai/evidencia/M-W1-REL-01/git-fingerprint-2026-09-17.log`; refresco de
wave 2 en `hospital-ai/evidencia/M-W1-REL-02/`.

## 2. Estado del árbol (captura 2026-09-17, refresco C1-REL-01)

Medición con `git status --porcelain` sobre la raíz escribible:

| Grupo (2 primeras columnas de porcelain) | Entradas |
|---|---|
| ` M` — rastreados modificados sin preparar | **290** |
| `??` — no rastreados (directorios colapsados) | **137** |
| Total de entradas | **427** |
| Índice (`git diff --cached --name-only`) | **0** |
| Commits creados | **0** |

- Comando: `git status --porcelain | ForEach-Object { $_.Substring(0,2) } | Group-Object`.
- **El conteo es un objetivo móvil y creció durante la jornada:** REL-01 midió
  213/102, `M-W1-QA-01` midió 260/119, REL-02 midió 274/123, el brief de la
  continuación C1 partió de 285/124 y C1-REL-01 midió 290/137 al capturar el
  manifiesto. Al cierre de C1-REL-01 seguía creciendo (otras tareas publicaron
  `CashSessionReportService.php`, más pruebas y más scripts de instalación). No
  se debe citar como cifra congelada ni reutilizar cifras de campañas previas
  (p. ej. el "106/24" del 2026-09-13, hoy obsoleto).
- **El fingerprint del diff rastreado también cambió:** el de cierre de campaña
  era `1713bd59ec0a076b01de07461559550a3d4fac9e`
  (`git diff HEAD --binary | git hash-object --stdin`); la captura del manifiesto
  C1-REL-01 midió `4fdaa93688dc95a86dcb7459d543b7447a382a31` y minutos antes/después
  se midieron `6f999424…` y `a0c38774…`. **Son medidas fechadas**: el valor
  vigente se lee de `hospital-ai/release/MANIFIESTO_PRODUCTO.json`
  (`base.fingerprint_git_hash_object`), nunca de este párrafo. El árbol **no**
  estaba congelado.
- Familias de cambios rastreados representativas: backend (acciones, controladores,
  requests, policies, rutas, seeders, config), frontend (rutas, shell, POS,
  historial, caja, reportes, tokens, hooks, tests), migraciones `2026_09_13_*`,
  `2026_09_14_*` y `2026_09_17_*`, scripts de certificación/recuperación, docs
  canónicos y este reporte.

### 2.1 Manifiesto de producto y reconstrucción (C1-REL-01)

Existe por primera vez un **manifiesto de producto verificable** —
`hospital-ai/release/MANIFIESTO_PRODUCTO.json` (+ `.sha256.txt`, sidecar,
`SNAPSHOT_PRODUCTO.sha256.txt`, `PARCHE_TRACKED.patch`, `README_MANIFIESTO.md`,
`tools/*.py`)— que registra ruta relativa, tamaño, SHA-256 completo y fin de
línea en disco de las **424 entradas** del producto (290 rastreados reemplazados
+ 134 archivos nuevos necesarios; 0 eliminaciones), separadas de logs, capturas
y artefactos de campaña.

- **Reconstrucción probada, no declarada:** desde `HEAD` + `PARCHE_TRACKED.patch`
  + los 134 archivos nuevos, en un directorio **fuera** del worktree, se obtuvo
  un árbol con **1994/1994 rutas del alcance byte-idénticas** (0 faltantes,
  0 discrepancias, `reconstruccion_identica = true`). Detalle y limitaciones en
  `hospital-ai/evidencia/C1-REL-01/INFORME.md`.
- **Limitación:** la igualdad vale para la instantánea del manifiesto. Con cinco
  tareas escribiendo en paralelo, una comprobación intermedia de citas encontró
  1 archivo desactualizado (`CashSessionReportService.php`). El manifiesto **no**
  es una certificación: mientras el worktree cambie, toda cita caduca.
- **Hallazgo de higiene del repo (abierto, requiere decisión):**
  `.gitattributes` declara `*.ps1 text eol=crlf`, pero los blobs y las copias en
  disco de los `.ps1` están en LF. Un `git checkout` normal de este mismo commit
  **no** reproduce el worktree actual. Además el `gitconfig` de sistema de esta
  máquina tiene `core.autocrlf=true`. Ambos efectos están neutralizados y
  documentados en `hospital-ai/release/README_MANIFIESTO.md`.

## 3. Paquete / artefacto candidato

- `installer-output/` **no existe** en este árbol (verificado con `Test-Path`).
  No hay `.exe` candidato ni hash de binario.
- `RESULT.json` existe **solo** en
  `qa/pre-installation-final/windows-clean/RESULT.json` con `status: "PENDING"`,
  `certification.delivery_ready: "NO"`, `production_certified: "NO"` y un
  `source_commit` histórico (`5e7d48ec…`) que **no** corresponde al HEAD actual.
- No existe ningún archivo `PASSED` en el árbol.
- `RESULT.json`/`PASSED` **no fueron editados ni promovidos** en esta tarea.
- USB no promovido; sin destino externo desplegado.

## 4. Los cuatro estados del mandato (§24)

Cada estado se reporta por separado. `PASS`/`FAIL`/`PARTIAL`/`NOT VERIFIED` es
por comprobación, con justificación.

### 4.1 IMPLEMENTACIÓN DEL ALCANCE — **PARTIAL**

- **Rutas montadas y alcanzables (verificado por lectura de fuente):** 14 rutas
  frontend declaradas en `frontend/src/navigation/appNavigation.ts` (más la ruta
  `*` de no-encontrado) mapeadas a componentes en `frontend/src/AppRoutes.tsx`;
  ~80 endpoints en `backend/routes/api.php` repartidos en caja, facturación, pagos,
  historial/reimpresión, catálogo/áreas, reportes, usuarios/roles, configuración
  fiscal/operativa, recibos institucionales, respaldos, salud/estado y auditoría.
- **Rediseño global (mandato §8) — ENTREGADO PARCIAL, en revisión:** tokens v2 y
  rediseño estructural de POS (columna estable), historial+detalle, shell
  (usuario/caja/conexión) y caja por `M-W2-FE-01/02/03`; `M-W2-FE-02` entregado y
  en revisión de coordinación, con contraste medido (9.59:1 / 12.07:1) y `axe`
  0 violaciones. Incluye el fix real de seguridad §10: **un `Enter` suelto ya no
  registra el pago; sólo `Ctrl/Cmd+Enter`** (`PaymentModal.tsx`). No hay cierre de
  verificación visual por todas las superficies.
- **Comprobante nuevo (mandato §12) — IMPLEMENTADO y con evidencia lógica:** existen
  `carta_vertical` (**215.9×279.4 mm = 612×792 pt**, `letter_portrait`) y
  `a4_vertical` (**210×297 mm = 595.28×841.89 pt**, `a4_portrait`) con
  `paper_kind` nativo (migración `2026_09_17_000005`, enum 6→8), sembrados activos
  y sin promover silenciosamente el default (sigue media carta). PDFs reales del
  motor con esas dimensiones, casos corto/largo/cero/anulado/reimpreso y textos
  ORIGINAL / PRIMERA COPIA / SEGUNDA COPIA / "REIMPRESIÓN #2"
  (`hospital-ai/evidencia/M-W2-RCP-01/`). Preview fiel al motor vía `test-preview`
  en iframe `sandbox=""`, **sin consumir correlativo** (`next_receipt_number=8`
  con `current_number=7`). **Impresión física: NOT VERIFIED.**
- **Multi-caja (mandato §7) — IMPLEMENTADO en dominio y verificado en MariaDB:** nuevo
  `cash_registers` + `cash_register_sessions.cash_register_id` (FK RESTRICT,
  nullable) + `open_marker` con UNIQUE `(cash_register_id, open_marker)`; el
  default sigue siendo **una caja** (`principal`, `CashRegisterSeeder`). Guard
  fail-closed por caja y corrección de `opened_at` (`2026_09_17_000004`).
  Concurrencia real: 6 tests/32 aserciones con procesos/conexiones independientes.
  **Pendiente:** total consolidado en UI y regresión 403 real (M-W2-FIN-02, en
  curso).
- **Estados de UI por ruta — PARTIAL:** verificado carga/error/vacío en dashboard,
  caja, catálogo, historial, respaldos, recibos y login; varias superficies quedan
  **PENDIENTE** de barrido completo (ver inventario en `HANDOFF_ACTUAL_CHATGPT.md`).
- **Conclusión:** el alcance del mandato avanzó de forma sustantiva (comprobante
  vertical/A4, multicaja, rediseño estructural, fix §10), pero **no está cerrado**:
  falta revisión/verificación visual final, total consolidado multi-caja y la
  validación física. Sigue **PARTIAL**.

### 4.2 VALIDACIÓN TÉCNICA ACTUAL — **PARTIAL / EN REPARACIÓN**

Estados **medidos el 2026-09-17** (fuente `M-W1-QA-01/INFORME.md` y `logs/`). No
son definitivos: los fallos están en reparación y el árbol sigue cambiando.

| Comprobación | Medido 2026-09-17 | Estado |
|---|---|---|
| Backend SQLite (`phpunit.xml`) | Tests 1194 / Assertions 8197 / Skipped 57 / 0 fallos (exit 0) | **PASS medido** |
| Backend MariaDB (`phpunit.mysql.xml`) | Tests 1198 / 8384 asserts / **6 errors + 2 failures** / 11 skipped (exit 2) | **FAIL — en reparación (M-W1-QA-02)** |
| Driver efectivo | SQLite `3.39.2`, MariaDB `10.4.32` (probe + guard in-process) | **PASS medido** |
| Frontend typecheck / lint / build | exit 0; build `4.56 s` | **PASS medido** |
| Frontend tests | **166 archivos / 1258 tests** (1256 jsdom + 2 storybook) | **PASS medido** |
| Bundle budget | Inicio 218.8 KiB gzip (límite 488.3) | **PASS medido** |
| E2E mock (Playwright) | **44 passed / 5 failed** | **FAIL — en reparación (M-W1-QA-02)** |
| Pint / PHPStan / audits | no incluidos en esa corrida | **NOT VERIFIED** |

- **Dos clases de fallo MariaDB:** 6 errores por contaminación de orden
  (`RefreshDatabase` + DDL con commit implícito; pasan aislados) y 2 fallos reales,
  uno la regresión 403 dependiente de driver/fecha
  (`InstitutionalReceiptPaymentIntegrationTest:137`, `COORD-11`, en reparación por
  M-W2-FIN-02). El job CI `backend-mariadb` está **rojo** con el árbol actual.
- **MariaDB 10.4.32 (XAMPP) local no es paridad** con la imagen `mariadb:11.4.3` de
  CI/compose (daemon Docker apagado); el conteo puede variar en 11.4.3.
- **E2E:** 5 fallos por specs obsoletas (selector `/^Carta\b/i` ambiguo por "Carta
  vertical", heading/endpoint de backups, fecha/catálogo), a reparar sin borrar
  (`COORD-09`).
- Docker daemon: **no disponible** (`com.docker.service` Stopped); sin `nginx -t`,
  `compose up`, drill real ni paridad de imágenes.
- Security/RBAC (37/203) y concurrencia (6/32) sí tienen evidencia real en la
  matriz §20.
- **No se reutilizan cifras de campañas previas** (p. ej. 1045/7554 de T2-013 o
  los conteos de junio-julio) como resultado actual. Un cambio posterior en el
  árbol invalida las pruebas afectadas.

### 4.3 VALIDACIÓN EN WINDOWS / LAN / IMPRESORA OBJETIVO — **NOT VERIFIED**

| Comprobación física | Estado | Sustento |
|---|---|---|
| VM Windows limpia / instalación offline | **NOT VERIFIED** | `qa/pre-installation-final/windows-clean/RESULT.json` = `PENDING` (evidencia de otro commit); M-W1-INST-01 declara VM no disponible |
| Impresora física institucional (carta vertical / A4 / media carta / A5) | **NOT VERIFIED** | Sin hardware; evidencia sólo lógica del motor (PDFs) |
| Segunda PC LAN / usuarios simultáneos | **NOT VERIFIED** | Solo contextos de navegador; sin segundo equipo. La matriz §20 marca LAN **PARTIAL**: separación de cajas verificada con conexiones independientes en MariaDB, pero sin segunda máquina física |
| Firma de código del instalador | **NOT VERIFIED** | Sin certificado; hoy `NotSigned` |
| Reinicio del equipo y arranque autónomo del runtime | **NOT VERIFIED** | No probado en hardware objetivo |
| Licencia Docker Desktop (decisión institucional) | **PENDIENTE** | `docs/OFFLINE_RUNTIME_LICENSE.md`; no se compró ni cambió nada |
| Destino externo de respaldo (USB/NAS) | **NOT VERIFIED (no desplegado)** | `HOSPITAL_BACKUP_EXTERNAL_ENABLED=false`; bind por defecto en el mismo host |

> **Presupuesto de honestidad:** todo lo anterior queda **NOT VERIFIED** y
> **no se declara certificación**. Ningún PASS documental sustituye una prueba
> física.

### 4.4 APROBACIÓN PARA ENTREGA — **NOT VERIFIED**

- No existe artefacto candidato congelado ni hashes de un binario (ver §3); el
  mandato §24 exige certificar y promover **exactamente** el artefacto congelado.
- `RESULT.json`/`PASSED` sin promover; `production_certified: "NO"`.
- Decisiones externas abiertas que condicionan la entrega (ver
  `docs/CAMPANA_2026-09-13_DECISIONES_Y_DEUDA.md` §2): cuántas cajas simultáneas,
  autorización EPO, copias por recibo, adopción TLS, custodia de claves, RPO/RTO,
  firma de código, retención legal, soporte bare-metal, destino externo y PDF
  firmado.
- **Conclusión: sin artefacto congelado no hay certificación posible.** Se mantiene
  **NOT VERIFIED**. No se declara `PRODUCTION_READY` ni `PRODUCTION_CANDIDATE`.
  El procedimiento de congelación (no ejecutado) está en
  `HANDOFF_ACTUAL_CHATGPT.md` §17.

## 5. Estado de las tareas wave 1/2 (declarado, no inventado)

Fuente: `hospital-ai/progreso/AGENTES.jsonl`,
`hospital-ai/progreso/TABLERO_MANDATO.md` y
`hospital-ai/progreso/MATRIZ_ACEPTACION.md` al 2026-09-17.

| Tarea | Agente | Estado declarado |
|---|---|---|
| M-W1-UX-01 | hs-ux | entregado; verificación de render pendiente |
| M-W1-BK-01 | hs-backups | aceptado (131 tests / 756 asserts / exit 0; revisión ACEPTABLE) |
| M-W1-INST-01 | hs-install | entregado (27/29 suites PS; 2 FAIL ambientales) |
| M-W1-REC-01 | hs-recovery | aceptado (10 suites PS; drill real BLOQUEADO_EXTERNO) |
| M-W1-SEC-01 | hs-security | aceptado (Security 37/203; pnpm audit = 0) |
| M-W1-QA-01 | hs-qa | entregado: SQLite PASS; MariaDB FAIL (6E/2F); E2E 44/5 |
| M-W1-QA-02 | hs-qa | **EN CURSO** — repara specs E2E, aislamiento MariaDB, `tests/Concurrent`, Pint/PHPStan |
| M-W2-FE-01/02/03 | hs-frontend | FE-02/03 entregados (1258 tests; en revisión) |
| M-W2-RCP-01/02/03 | hs-receipts | entregados (PDFs 612×792 y 595.28×841.89; preview fiel) |
| M-W2-DB-01/02 | hs-db | entregados (MariaDB real 32/32 y 42/42) |
| M-W2-FIN-01 | hs-finance | entregado (concurrencia 6/32 PASS) |
| M-W2-FIN-02 | hs-finance | **EN CURSO** (regresión 403 real + total consolidado) |
| M-W2-REV-01 | hs-review | revisiones RV-M-W1-BK-01/SEC-01 ACEPTABLES |

Los resultados citados pertenecen a los informes de esos agentes; este documento
no los revalida ni los convierte en certificación.

## 6. Reglas de promoción vigentes

1. No se edita `RESULT.json`/`PASSED` para simular una prueba ejecutada.
2. No se promueve USB ni se declara `PRODUCTION_READY` sin pruebas reales.
3. Se congela el árbol y se registra HEAD + huella de diff + hash del candidato
   antes de cualquier certificación; no se certifica mientras el artefacto cambie.
4. Las cifras de campañas anteriores son **históricas**, no actuales.
5. Lo no ejecutado se declara `NOT VERIFIED`; no se falsifica.

## 7. Enlaces canónicos

- `hospital-ai/MANDATO_DEFINITIVO.md` — mandato vigente (§20, §23, §24).
- `HANDOFF_ACTUAL_CHATGPT.md` — handoff autocontenido (raíz del repo); §17 =
  procedimiento de congelación.
- `hospital-ai/progreso/MATRIZ_ACEPTACION.md` — matriz §20 vigente con evidencia real.
- `hospital-ai/progreso/TABLERO_MANDATO.md` — tablero de trabajo.
- `hospital-ai/progreso/ESTADO.md`, `AGENTES.jsonl`.
- `docs/CAMPANA_2026-09-13_DECISIONES_Y_DEUDA.md` — decisiones y deuda diferida.
- `docs/00_README.md` — índice de documentación.
- `hospital-ai/evidencia/M-W1-REL-01/` y `hospital-ai/evidencia/M-W1-REL-02/` —
  evidencia de estas tareas documentales.

---

# Histórico

> Contenido **histórico**, conservado como trazabilidad. No es el estado vigente.
> Las secciones 8–9 reproducen el estado canónico anterior (campaña T2,
> 2026-09-13) y las secciones 10–20 reproducen el registro de junio-julio 2026.
> Varias describen otro HEAD, otra rama y evidencia ya superada.

## 8. Estado canónico anterior — campaña T2 (2026-09-13) — SUPERSEDED

- **Estado:** `NOT_READY`. Fuente canónica de estado en su momento.
- **HEAD:** `baa41f97310a578f8fd417a1e9b4b5d06c380670`, worktree aislado detached
  en `C:\Projects\S_Hospital_AI`, 0 commits creados.
- **Árbol:** sucio por diseño: 106 archivos rastreados modificados y 24 entradas
  no rastreadas de la campaña (conteo del 2026-09-13). Huella del diff rastreado
  registrada en `hospital-ai/evidencia/T2-006/INFORME.md`.
- **Paquete/candidato:** `installer-output/` no existe; no hay `.exe` candidato ni
  hash de binario. `RESULT.json`/`PASSED` no se editaron y no se promovió USB.

### 8.1 Cambios locales de la campaña por familia

| Familia | Cambios representativos |
|---|---|
| Recuperación y consola de mantenimiento | `scripts/maintenance_hospital_windows.ps1`, `scripts/restore_hospital_windows.ps1`, `scripts/lib/recovery_docker.ps1`, `scripts/lib/recovery_runtime.ps1` y sus tests |
| Guard de migración / actualización | `backend/app/Console/Commands/VerifyMigrationBackupCommand.php`, `backend/docker/entrypoint.sh`, `.env.example`, `scripts/deploy_hospital_lan.ps1`, `scripts/deploy_upgrade_guard.test.ps1` |
| Certificación y paquete offline | `scripts/certification/*`, `scripts/assert_offline_release_clean.ps1`, `scripts/offline_release_contract.test.ps1`, `scripts/load_offline_images.ps1` y tests |
| Backend (API, permisos, recibos, salud) | Controladores, actions y middleware de recibos/health, rutas, seeders, `phpunit.xml` y tests |
| Esquema e integridad | Migraciones `2026_09_13_*` (constraints monetarios, singleton fiscal, perfiles de recibo, rangos de serie, métodos de pago y caja en facturas pagadas) |
| Frontend (shell, rutas, atajos, sesión) | `frontend/src/AppRoutes.tsx`, `InstitutionalShell.tsx`, hooks de sesión/estado/shortcuts y tests |
| TLS/WSS opt-in y salud | `docker-compose.tls.yml`, `nginx/tls.conf`, `scripts/generate_local_ca.ps1`, `backend/config/sanctum.php` (derivación de orígenes), `EchoConfigController` (ws/wss) y tests dirigidos |
| Documentación y estado | `README.md`, `docs/**` canónicos, `CHANGELOG.md`, este reporte |

### 8.2 Modo TLS opcional (histórico)

El modo TLS/WSS existe como **opt-in** y no está activado por defecto: el compose
base sigue HTTP-only. Se activa con
`docker compose -f docker-compose.prod.yml -f docker-compose.tls.yml up -d`,
`HOSPITAL_TLS_ORIGIN`, CA local (`scripts/generate_local_ca.ps1`) y firewall 443.
Con el overlay activo, el puerto HTTP no sostiene sesión autenticada (cookies
Secure; 401/419) y el rollback es reiniciar sin el overlay. No hay `nginx -t` ni
`docker compose up` ejecutados en la campaña; **no se declara certificación TLS**.
Detalle en `docs/HTTPS_OPTIONAL.md`.

### 8.3 Pendientes externos (no ejecutados en la campaña T2)

- Prueba en Windows limpio del instalador (VM sin checkout del repositorio).
- Impresión física institucional en media carta, carta y A5.
- Validación desde una segunda PC LAN.
- Firma de código institucional (certificado real; hoy `NotSigned`).
- Restore/recuperación productiva en el hardware del hospital.
- TLS real: CA instalada en cada PC, firewall 443, retirada del puerto 6001,
  navegador por WSS y modo TLS configurable en el instalador.

### 8.4 Progreso de campaña (snapshot 2026-09-14, histórico)

Conteo al 2026-09-14 (captura 07:04; fuente: `hospital-ai/progreso/TAREAS.json`,
campo `updated: 2026-09-14`; 62 entradas en `tasks` + 6 en `queue`; comando y
salida cruda en `hospital-ai/evidencia/T3-008/registry-counts-2026-09-14.log`):

| Grupo (prefijo de `status`) | Entradas |
|---|---|
| `accepted*` — revisión aceptada localmente (varias con observaciones P3) | 31 |
| `completed*` — implementadas/cerradas, con revisión pendiente, por lote o en curso | 22 |
| `running*` / `fix_in_progress*` — en curso | 9 |
| `queue` — pendientes/encoladas | 6 |

Revisiones cerradas al momento de la captura: 5 (RV-T2-030, RV-T2-036b y
RV-T2-038 `ACEPTABLE` —esta última derivó T3-009—; RV-T2-037 y RV-T2-041b
`REQUIERE_CAMBIOS`, con corrección en curso T3-005/T3-008).

Hallazgos registrados (fuente: `hospital-ai/progreso/HALLAZGOS.json`, 66 con
estado; sin cambios respecto al snapshot 2026-09-13): 26 `CONFIRMADO`, 21
`CORREGIDO_SIN_VALIDAR`, 9 `PENDIENTE_VERIFICAR`, 6 `EN_CURSO`, 1 `VERIFICADO`,
1 `DECISION_NEGOCIO`, 1 `MEJORA_OPCIONAL_NO_REQUERIDA`,
1 `DESCARTADO_CON_EVIDENCIA`.

### 8.5 Evidencia de la campaña T2 (histórico)

- `hospital-ai/evidencia/` (informes por tarea: T1-*, T2-*), en particular
  `hospital-ai/evidencia/T2-041/INFORME.md` (consolidación de decisiones).
- `hospital-ai/progreso/TAREAS.json`, `ESTADO.md`, `HALLAZGOS.json`, `DECISIONES.md`.
- `docs/CAMPANA_2026-09-13_DECISIONES_Y_DEUDA.md`.

## 9. Actualización 2026-07-05 (histórico)

Esta sección corrige evidencia obsoleta sin declarar producción lista.

- Rama histórica: `codex/refactor-total`.
- El objetivo era una release local monocomputadora; la prueba desde una segunda
  PC LAN quedaba como validación física para despliegues multi-PC.
- `docker compose exec backend composer validate/audit`: PASO (contenedor).
- `docker compose exec frontend npm audit --audit-level=high --json`: PASO,
  0 vulnerabilidades (evidencia containerizada, no host).
- `npm run typecheck`, `npm run lint`, `npm run build`: PASO el 2026-07-05.
- Gate backend enfocado del núcleo: PASO, 254 tests / 2032 aserciones.
- `npm.cmd run e2e` fallaba por preflight (faltaba `backend/vendor/autoload.php`
  en host).
- `qa/production-audit/button-smoke-report.json` regenerado el 2026-07-05 con 79
  resultados `passed`.
- Estado global histórico: `NOT_READY` (faltaba cierre del worktree, E2E host,
  evidencia de impresión/restore/backup worker, configuración production real,
  admin real y paquete offline final).

## 10. HEAD histórico (2026-06-15)

- HEAD: `605d2bcac0678e88d1b9e4c21055a8775f8e25f0`
- Último commit: `605d2bca merge: final security lan hardening release candidate`
- Rama: `hardening-audit-complete-2026-06-15`

## 11. Estado git histórico (2026-06-15)

Resultado de `git status --short --untracked-files=all`: worktree sucio.

Archivos modificados principales:

- `.github/workflows/ci.yml`
- `CHANGELOG.md`
- Backend: acciones de backups, billing, receipts, reports, comandos, middleware,
  requests, modelo User, rutas, seeders y tests.
- Docs: backup/restore, CI, decisions, disaster recovery, fiscal rules, HTTPS,
  release checklist, secrets.
- Frontend: areas, receipts, hooks, API base/billing y tests.
- Scripts: `production_readiness_preflight.ps1`,
  `restore_hospital_windows.ps1`.
- `AGENTS.md` y `docs/00_README.md` corregidos en esa reconciliación.

Archivos no rastreados principales:

- `backend/app/Actions/Backups/EncryptBackupFileAction.php`
- `backend/app/Console/Commands/DecryptBackupCommand.php`
- `backend/app/Console/Commands/PruneIdempotencyKeysCommand.php`
- `backend/app/Support/ExcelSafe.php`
- Migraciones `2026_06_15_000001` a `2026_06_15_000003`
- Tests nuevos backend/frontend
- `subagents/16_*.md` a `subagents/30_*.md`
- `worklogs/2026-06-15-audit-infra-deployment.md`
- `reports/CURRENT_RELEASE_TRUTH.md`

## 12. Comandos ejecutados (2026-06-15, histórico)

| Comando | Directorio | Resultado | Salida exacta/resumen verificable |
| --- | --- | --- | --- |
| `git branch --show-current` | repo | PASO | `hardening-audit-complete-2026-06-15` |
| `git rev-parse HEAD` | repo | PASO | `605d2bcac0678e88d1b9e4c21055a8775f8e25f0` |
| `git status --short --untracked-files=all` | repo | PASO | Worktree sucio con archivos modificados y no rastreados listados arriba. |
| `git log --oneline -5` | repo | PASO | `605d2bca merge: final security lan hardening release candidate`; `fa4704da fix(release): harden backup restore and lan deployment security`; `e6806f46 docs(manuals): add field validation checklist and cashier short guide`; `79c1609e Merge branch 'fix/pos-dialysis-permission-gate-2026-06-15' into main`; `3f001dc1 fix(pos): gate dialysis prescription control by permission` |
| `composer validate` | repo | NO INSTALADO | `composer : El termino 'composer' no se reconoce...` |
| `composer audit --no-interaction` | repo | NO INSTALADO | `CommandNotFoundException` |
| `npm audit --audit-level=high` | `frontend` | FALLO | PowerShell intentó cargar `npm.ps1` y falló por ExecutionPolicy. |
| `npm.cmd audit --audit-level=high` | `frontend` | FALLO | 8 vulnerabilities: 1 low, 1 moderate, 6 high. |
| `npm.cmd run typecheck` | `frontend` | PASO | `tsc --noEmit` sin errores. |
| `npm.cmd run lint` | `frontend` | PASO | `eslint .` sin errores. |
| `npm.cmd run test` | `frontend` | PASO | 66 test files passed, 290 tests passed. |
| `npm.cmd run build` | `frontend` | PASO | Vite build OK, 2757 módulos. |
| `npm.cmd run e2e` | `frontend` | FALLO | Faltaba `E2E_SEED_PASSWORD`. |
| `php artisan test --colors=never` | `backend` | PASO | 556 passed, 11 skipped, 3586 assertions. |
| `vendor/bin/pint --test` | `backend` | PASO | `passed` |
| `vendor/bin/phpstan analyse` | `backend` | PASO | `[OK] No errors`, 194/194 files. |
| `php artisan config:cache` / `config:clear` | `backend` | PASO | cache creado/limpiado. |

## 13. Contradicciones encontradas (2026-06-15, histórico)

1. `AGENTS.md` todavía definía el producto como emisión de recibos térmicos.
2. `docs/00_README.md` describía `qa/FINAL_PRODUCTION_HANDOFF_RESULT.md` como
   "PRODUCTION_READY=YES".
3. Documentos históricos mencionaban fases hacia `PRODUCTION_READY` o impresoras
   térmicas.
4. Reportes previos de F7 decían que `npm run e2e` pasaba; en ese HEAD fallaba por
   password de seed E2E.
5. Composer no disponible en PATH del host.
6. `phpstan` no instalado era histórico; en `backend/vendor` sí existía.

## 14. Contradicciones corregidas (2026-06-15, histórico)

1. `AGENTS.md`: recibo principal institucional PDF/papel; formatos carta, media
   carta o A5; 80mm/58mm solo compatibilidad secundaria; sin QR/códigos en el
   recibo principal.
2. `docs/00_README.md`: dejó de afirmar `PRODUCTION_READY=YES`.
3. `reports/CURRENT_RELEASE_TRUTH.md` creado como fuente de verdad de esa etapa.

## 15. Estado real histórico (2026-06-15)

Estado único histórico: `NOT_READY`.

## 16. Bloqueantes históricos (2026-06-15)

1. Worktree sucio con cambios no cerrados y archivos no rastreados.
2. `npm.cmd run e2e` host requería `backend/vendor/autoload.php`.
3. Faltaba prueba de impresión institucional/PDF final.
4. Faltaba prueba desde segunda PC LAN si el despliegue era multi-PC.
5. Faltaba restore final en servidor/base descartable.
6. Faltaba worker continuo de backups validado en servidor final.
7. Faltaba configuración production real.
8. Faltaba admin real creado sin seeders de validación.
9. Faltaba paquete offline regenerado desde el commit final.
10. Faltaba guard de release limpio sobre ese paquete final.

## 17. Pendientes no bloqueantes históricos (2026-06-15)

1. Módulos clínicos completos (médicos, citas, consultas, historial clínico,
   laboratorio, farmacia/inventario, habitaciones, admisiones, emergencias).
2. Optimización fina de bundles frontend.
3. Dashboard de salud/observabilidad más profundo.
4. Limpieza de documentos históricos.

## 18. Qué se podía presentar (2026-06-15, histórico)

Demo técnica controlada del núcleo: login local, roles/permisos, caja,
facturación, regla de eritropoyetina, pagos, recibo institucional PDF/papel,
historial/reimpresión, reportes y backups como flujo probado por tests.

## 19. Qué NO se debía prometer (2026-06-15, histórico)

`PRODUCTION_READY`; validación clínica u operativa formal; segunda PC LAN
validada; impresora física validada; restore final validado; worker continuo de
backups instalado; paquete offline final regenerado; módulos clínicos completos;
`npm audit`/`composer audit` en host.

## 20. Próximo paso exacto histórico hacia PRODUCTION_READY (2026-06-15)

1. Cerrar el E2E host.
2. Revisar el worktree sucio, separar cambios por fase, ejecutar gates y commitear.
3. Regenerar paquete offline desde el commit final.
4. Ejecutar guard de release limpio.
5. En servidor final: production real, admin real y worker continuo de backups.
6. Documentar impresión institucional, restore final, concurrencia y segunda PC LAN.
7. Ejecutar `scripts/production_readiness_preflight.ps1` sin bypass.

Solo después de esos pasos se podía evaluar `PRODUCTION_READY`.
