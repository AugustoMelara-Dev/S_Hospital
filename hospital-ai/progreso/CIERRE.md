# CIERRE — Campaña S_Hospital bajo el Mandato Definitivo (2026-09-17)

Coordinador: `hs-orchestrator`. Encargo vigente: `hospital-ai/MANDATO_DEFINITIVO.md`.
Este documento cierra la campaña **sin declarar certificación**.

---

## 1. Identidad del artefacto medido (congelación)

| Dato | Valor |
|---|---|
| Raíz escribible | `C:\Projects\S_Hospital_AI` (worktree aislado, detached) |
| Origen intocable | `C:\Projects\S_Hospital` (0 cambios) |
| HEAD | `baa41f97310a578f8fd417a1e9b4b5d06c380670` |
| Commits creados | **0** (por instrucción: sin commits/push) |
| Fingerprint del diff rastreado | `1713bd59ec0a076b01de07461559550a3d4fac9e` (`git diff HEAD --binary \| git hash-object --stdin`) |
| Índice (staged) | vacío (`e69de29b…` = blob vacío) |
| Árbol | 285 archivos rastreados modificados + 124 entradas no rastreadas |
| Artefactos | `MANDATO_DEFINITIVO.md` `BFD88AD256FEABB1` · `HANDOFF_ACTUAL_CHATGPT.md` `50B434B7562BCA5D` · `CURRENT_RELEASE_TRUTH.md` `A9205F7D2E8BA571` · `MATRIZ_ACEPTACION.md` `E34F6D3EAE6C12AE` · `TABLERO_MANDATO.md` `98B87EDAA56D4758` (SHA-256, 16 hex) |

Un cambio posterior en código, migraciones o prueba **invalida** las mediciones de la sección 4.

---

## 2. Los cuatro estados (separados, como exige §24)

### 2.1 IMPLEMENTACIÓN DEL ALCANCE — **PARTIAL**

Implementado y verificado en este árbol:

- **Coordinación y permisos (§2):** prohibición general de Playwright/Puppeteer/`test:e2e`
  **revocada** en los 13 agentes con allowlists acotadas; protecciones de secretos,
  `git commit/push/reset/clean`, `docker compose down -v`, `migrate:fresh`, `db:wipe`
  conservadas. Permiso efectivo comprobado (rechazo → aceptación tras la edición).
  Diff y copias en `hospital-ai/evidencia/A0-coordinacion/`.
- **Skills (§5):** `better-ui` y `emil-design-eng` instaladas y **leídas**, con hashes;
  aplicadas con valores exactos (no promediados).
- **Comprobante (§12/§13):** perfiles **carta vertical 215.9×279.4 mm (612×792 pt)** y
  **A4 210×297 mm** con `paper_kind` nativo; copias ORIGINAL/1.ª/2.ª con el mismo número;
  paginación; marca y contador de reimpresión; preview que consume el **HTML real del motor**
  y **no consume correlativo** (`next_receipt_number=8` con `current_number=7`).
- **Cajas simultáneas (§7):** dimensión de caja (`cash_registers`, `cash_register_id`,
  `open_marker` con UNIQUE por caja), aperturas simultáneas en cajas distintas, cierre vs
  cobro, idempotencia, y total consolidado por caja con contrato HTTP.
- **Integridad de timestamps (hallazgo propio):** 7 columnas con `ON UPDATE
  current_timestamp()` implícito estabilizadas; `invoices.issued_at` dejaba de ser la hora
  real de emisión en cada cobro.
- **Rediseño operativo (§8/§9/§10):** tokens v2, POS/historial/shell/caja, y corrección de
  un defecto de seguridad real (un `Enter` suelto **registraba el pago**).
- **Offline/LAN (§16/§17), seguridad (§15), respaldos (§18), recuperación:** endurecidos y
  probados en lo ejecutable.

**No implementado / pendiente declarado:**
- Superficie visual del total consolidado por caja (`M-W2-FE-04`): contrato HTTP y pruebas
  existen; falta montarlo en reportes.
- `M-W2-FE-02` reconoció que la "columna estable" del POS ya existía (aporte presentacional).

### 2.2 VALIDACIÓN TÉCNICA ACTUAL — **PASS en lo ejecutado, con skips declarados**

| Comprobación | Comando | Resultado |
|---|---|---|
| Backend SQLite (full) | `php vendor\bin\phpunit` | **1264 tests / 8662 aserciones / 66 skipped / exit 0** |
| Backend MariaDB 10.4.32 (full) | `php vendor\bin\phpunit -c phpunit.mysql.xml` | **1260 tests / 8649 aserciones / 65 skipped / exit 0** |
| Driver DB efectivo | guard in-process | SQLite `3.39.2`; MariaDB `10.4.32-MariaDB` (no por variable) |
| Concurrencia | `--testsuite=Concurrent` sobre MariaDB | **OK 8 tests / 46 aserciones** |
| Console (paridad CI) | `-c phpunit.mysql.xml --testsuite=Console` | **OK 13 tests / 55 aserciones** |
| Frontend typecheck / lint | `corepack pnpm run typecheck \| lint` | exit 0 |
| Frontend tests | `corepack pnpm run test` | **166 archivos / 1261 tests passed / exit 0** |
| Frontend build | `corepack pnpm run build` | exit 0 |
| E2E mock | `node scripts/run-mock-e2e.mjs` | **exit 0**; shell 4/4, billing-catalog-admin 18, receipts-reports 27 |
| Pint | `vendor\bin\pint --test` | **PASS, 544 archivos** |
| PHPStan | `vendor\bin\phpstan analyse` | **`[OK] No errors`** |
| Seguridad | `--filter=Security` | OK 37/203 |
| Auditoría de dependencias | `corepack pnpm audit` | **0 vulnerabilidades** (el hallazgo previo de 5 advisories era falso positivo por lockfile secundario) |

**Límites que impiden llamarlo PASS global:** MariaDB se ejecutó contra **10.4.32 local
(XAMPP)**, no contra la imagen **11.4.3** de CI → **no es paridad**. Los `skips` (65/66) no
están todos justificados uno por uno en este documento; su detalle está en
`hospital-ai/evidencia/M-W1-QA-01/` y `M-W1-QA-02/`.

### 2.3 VALIDACIÓN EN WINDOWS / LAN / IMPRESORA OBJETIVO — **NOT VERIFIED**

Nada de esto se ejecutó, y por tanto nada se declara:

- Impresora institucional física (carta vertical / A4 / media carta / A5) y salida de papel.
  Un PDF correcto de 612×792 pt **no** demuestra que imprimió.
- VM Windows limpia e instalación offline con WAN bloqueada desde antes de iniciar.
- Segunda PC LAN con usuario y caja distintos.
- Reinicio del equipo y arranque autónomo de servicios.
- Firma de código institucional.
- Destino externo de respaldo (USB/NAS) y custodia de claves en el hospital.
- TLS real con CA instalada en cada cliente.

**Bloqueo transversal:** el daemon Docker estaba **apagado**, lo que impidió `docker load`,
`docker compose up`, `nginx -t`, el drill de restore con contenedor y la prueba LAN real.

### 2.4 APROBACIÓN PARA ENTREGA — **NOT VERIFIED**

- `RESULT.json` **no** fue promovido ni editado; no se marcó `PASSED`.
- No se promovió USB ni se generó `.exe`: `installer-output/` no existe.
- No hay artefacto binario congelado ni hash de candidato.
- Los gates de certificación no se alteraron para obtener verde.

---

## 3. Defectos reales encontrados y corregidos (valor de la campaña)

| # | Defecto | Detección | Corrección verificada |
|---|---|---|---|
| 1 | `invoices.issued_at` reescrito por `ON UPDATE` implícito → **hora de emisión fiscal corrompida en cada cobro**; producía un 403 incorrecto en el segundo pago (MariaDB) | hs-qa (403) + hs-finance (causa raíz) | Trait de preservación + migración `000006` sobre 7 columnas; prueba roja→verde; SHA-256 de filas idéntico antes/después |
| 2 | `cash_register_sessions.opened_at` corrompido al cerrar | hs-db | Migración `000004`, reversible e idempotente |
| 3 | Un `Enter` suelto en monto/referencia **registraba el pago** | hs-frontend | `Ctrl/Cmd+Enter` obligatorio + regresión sensible |
| 4 | Etiqueta "Factura" invisible (blanco sobre blanco) en el paso de cobro | hs-ux (verificado por el coordinador) | `text-muted-foreground` + test |
| 5 | Dos cajas distintas hacían **deadlock InnoDB 1213 enmascarado como "caja ocupada"** | hs-finance | Reanclaje del lock + reintento acotado; 6/32 casos de concurrencia |
| 6 | Barrido sistémico: **7** columnas con `ON UPDATE` implícito (4 conocidas + 3 que nadie había visto) | hs-db | Migración `000006` |
| 7 | Job CI `backend-mariadb` **rojo** (contaminación de orden) y `tests/Concurrent` sin suite | hs-qa | Aislamiento reparado; suite `Concurrent` cableada (8/46 sobre MariaDB) |
| 8 | `phpunit.mysql.xml` **omitía la testsuite `Console`** | coordinador | Añadida; 13/55 OK sobre MariaDB |
| 9 | 5 specs E2E obsoletas + 11 handlers faltantes (44/5 → **49/0**) | hs-qa | Reparadas sin borrar ni desactivar assertions |
| 10 | `.dockerignore` re-incluía `frontend/.env.production` en el contexto de imagen | hs-install + hs-security | Retirado; `base.ts:234` prueba comportamiento idéntico |
| 11 | 39 errores de PHPStan introducidos por la campaña | coordinador | 0 errores, por causa raíz (sin `@phpstan-ignore` ni baseline) |

**Evidencia no trazable corregida:** un informe citaba un hash inexistente y un conteo
inflado; se corrigió con nota fechada, sin borrar el rastro, y se añadió una tabla
cifra→fuente.

---

## 4. Riesgos residuales

1. **Paridad de motor:** MariaDB 10.4.32 local ≠ imagen 11.4.3 de CI.
2. **Skips:** 65–66 pruebas se omiten; no se auditó cada uno en este cierre.
3. **Cobertura física:** impresora, VM, LAN, firma, destino externo y custodia → sin evidencia.
4. **Higiene del repo:** lockfiles duales en `frontend` (`pnpm` canónico + `package-lock.json`
   residual) y `pnpm-workspace.yaml` sin clave `packages`.
5. **`frontend/.env.production` sigue rastreado** (valor público y vacío); debe destrackearse
   con `git rm --cached` en el próximo commit.
6. **Persistencia de la protección:** el trait de timestamps se conserva como defensa en
   profundidad mientras existan instalaciones sin migrar; retirarlo requiere que `000006`
   esté aplicada en todos los destinos.
7. **`explicit_defaults_for_timestamp=1`** no se pudo probar (variable read-only en 10.4).
8. **Consolidado a volumen:** recorre sesión por sesión, acotado a 31 días; sin medición de
   rendimiento con datos grandes.

---

## 5. Decisiones que requieren autoridad humana (no las tomó el agente)

1. Cuántas copias imprimirá cada puesto y en qué formato (el perfil de entrega es una
   propuesta explícita y configurable, no una política impuesta).
2. Licencia de runtime: **Docker Desktop exige suscripción para entidades gubernamentales**;
   Docker Engine es Apache-2.0 pero requiere host Linux. Decisión institucional documentada
   en `docs/OFFLINE_RUNTIME_LICENSE.md`.
3. Adopción final de TLS/CA y quién administra la autoridad local.
4. Destino y custodia reales del respaldo externo.
5. Firma de código institucional (requiere certificado legítimo).

---

## 6. Cómo continuar (procedimiento exacto)

1. Levantar el daemon Docker y ejecutar el drill de restore desechable:
   `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\recovery_disposable_drill.ps1 -BackupFile <sintetico> -ExpectedSha256 <sha256>`.
2. Re-ejecutar los E2E con **backend y base reales** (`test:e2e:release`), no solo el runner mock.
3. Repetir la suite completa contra **MariaDB 11.4.3** (imagen de CI) para cerrar la paridad.
4. Completar la superficie visual del consolidado (`M-W2-FE-04`) y volver a medir.
5. Al cerrar: recalcular el fingerprint, re-ejecutar las suites afectadas y **solo entonces**
   evaluar la promoción del candidato.
