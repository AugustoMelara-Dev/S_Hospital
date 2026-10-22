# TABLERO — Mandato Definitivo S_Hospital (2026-09-17)

> **Reconciliación C1 (2026-09-17).** Las secciones "Bloque B/C" de abajo son fotografía de la
> primera fase. El **estado vigente** está en la sección **"Continuación C1"** al final y en
> `CIERRE.md` / `MATRIZ_ACEPTACION.md`. Detalle de la reconciliación en `DECISIONES.md`
> (§"Reconciliación C1"). Ningún estado se subió a PASS por hacer coincidir documentos.

Política de trabajo (no flags nativos): hasta 6 trabajos activos, máximo 2
pesados (build/test/DB full) simultáneos, un dueño de escritura por archivo, sin
recursión de subagentes. Coordinador: `hs-orchestrator`.

Evidencia por tarea en `hospital-ai/evidencia/<TASK_ID>/`. Revisiones
independientes en `hospital-ai/evidencia/revisiones/`. Sesiones reales en
`hospital-ai/progreso/AGENTES.jsonl`.

## Bloque A — Coordinación, permisos, skills (coordinador)

| ID | Requisito | Estado | Evidencia |
|----|-----------|--------|-----------|
| A-01 | Mandato vigente guardado; PROMPT_MAESTRO histórico | HECHO | `hospital-ai/MANDATO_DEFINITIVO.md` |
| A-02 | `/hs-terminar` apunta al mandato vigente | HECHO | `.opencode/commands/hs-terminar.md` |
| A-03 | Revocar prohibición Playwright/Puppeteer/test:e2e (13 agentes) | HECHO | `permissions.diff` + backups |
| A-04 | Permiso efectivo comprobado tras recarga | HECHO | probe rechazado → aceptado |
| A-05 | Skills better-ui y emil-design-eng instaladas y leídas | HECHO | `.agents/skills/`, hashes |
| A-06 | AGENTS.md actualizado | HECHO | sección "Campaña Vigente Y Coordinación" |
| A-07 | Baseline de inventario | HECHO | ESTADO.md / este tablero |

## Bloque B — Wave 1

| ID | Agente | Objetivo | Estado | Evidencia / resultado |
|----|--------|----------|--------|----------------------|
| M-W1-UX-01 | hs-ux | Contrato visual v2 + tokens | ENTREGADO (render NOT VERIFIED) | `diseno/TOKENS_V2.md`, `CONTRATO_PANTALLAS_V2.md`, `CRITERIOS_RECIBO_V2.md` |
| M-W1-BK-01 | hs-backups | Copia externa, claves, alertas, RPO/RTO | ACEPTADO (revisión independiente ACEPTABLE) | 131 tests / 756 aserciones / exit 0; `recovery_stale` nueva; O-01 cerrado por el coordinador |
| M-W1-INST-01 | hs-install | Offline/LAN, preflight, checksums, licencia Docker | ENTREGADO (2 FAIL ambientales) | 27/29 suites PS; `docs/OFFLINE_RUNTIME_LICENSE.md` |
| M-W1-REC-01 | hs-recovery | Consola/restore + correlativos post-restore | ACEPTADO | 10 suites PS exit 0; drill real BLOQUEADO_EXTERNO (daemon apagado) |
| M-W1-SEC-01 | hs-security | Seguridad LAN, permisos, TLS opt-in, secretos | ACEPTADO (revisión ACEPTABLE; F3 era falso positivo) | `LanEndpointAccessTest` 11/77; Security OK 37/203; pnpm audit = 0 vulnerabilidades |
| M-W1-REL-01 | hs-release | Estado canónico + handoff | ENTREGADO | `HANDOFF_ACTUAL_CHATGPT.md`, `reports/CURRENT_RELEASE_TRUTH.md` con 4 estados |
| M-W1-QA-01 | hs-qa | Baseline verificación + driver DB + E2E local | ENTREGADO — SQLite PASS 1194/8197; MariaDB FAIL (2 reales + 6 aislamiento); E2E 44/5 |
| M-W1-QA-02 | hs-qa | Reparar specs E2E obsoletas, aislamiento MariaDB (CI rojo), `tests/Concurrent`, Pint/PHPStan | EN CURSO (pesado) |

## Bloque C — Wave 2

| ID | Agente | Objetivo | Estado |
|----|--------|----------|--------|
| M-W2-FE-01 | hs-frontend | Tokens v2 + correcciones HIGH/MEDIUM + tipografía | ACEPTADO PARCIAL (layout estructural declarado NO entregado) | 1255 tests / build OK / axe 0 violaciones; HIGH white-on-white corregido con test |
| M-W2-FE-02 | hs-frontend | Rediseño **estructural**: POS columna estable, historial+detalle, shell usuario/caja/conexión, caja, administrativas, responsive | **ENTREGADO** — incluye fix REAL de §10 (Enter suelto cobraba) verificado por el coordinador; 1258 tests; en revisión |
| M-W2-FE-03 | hs-frontend | Cerrar observaciones de la revisión (tokens oscuros del contrato, señal no cromática, higiene de evidencia) | **ENTREGADO** — contraste medido 9.59:1/12.07:1, sin promediar; glifo + texto en el indicador |
| MATRIZ §20 | hs-orchestrator | Matriz de aceptación con evidencia real y NOT VERIFIED | HECHO → `hospital-ai/progreso/MATRIZ_ACEPTACION.md` |
| M-W2-RCP-01 | hs-receipts | Carta vertical 612×792 pt + A4, copias, paginación, reimpresión | ENTREGADO PARCIAL (tope de pasos) | PDFs reales: 612×792 pt y 595.28×841.89 pt; ORIGINAL/1ª/2ª copia y "REIMPRESIÓN #2" extraídos del PDF; 96/1648 focal |
| M-W2-RCP-02 | hs-receipts | Cablear preview al HTML real del motor (`/test-preview`) + prueba de fidelidad | **ENTREGADO** — HTML real 32 KB/21 KB; `next_receipt_number=8` con `current_number=7` (no consume correlativo) |
| M-W2-RCP-BLK | hs-db | Migración del enum `paper_kind` para valores portrait nativos | **HECHO** (`2026_09_17_000005`, MariaDB 42/42) |
| M-W2-FIN-01 | hs-finance | Cajas simultáneas sin mezclar dinero, carreras factura/cierre, idempotencia | **ENTREGADO** — MariaDB real `group=concurrent` 6/32 PASS; corrigió deadlock InnoDB 1213 enmascarado como "caja ocupada"; `opened_at` preservado |
| M-W2-FIN-02 | hs-finance | Regresión real 403 + total consolidado por caja | **ENTREGADO** — causa raíz: `invoices.issued_at` con `ON UPDATE` implícito; trait de preservación + `GET /api/cash-sessions/consolidated` (30.00 = 10.00 + 20.00, sin mezclar) |
| M-W2-DB-03 | hs-db | Barrido **sistémico** de columnas con `ON UPDATE` implícito + migraciones estabilizadoras | EN CURSO |
| M-W2-RCP-04 | hs-receipts | Preservar timestamps de hechos históricos en rutas de recibos (`ReprintReceiptAction`) | EN CURSO |
| M-W2-FE-04 | hs-frontend | Exponer el total consolidado por caja en reportes (contrato HTTP ya existe) | ENCOLADO |
| M-W2-DB-01 | hs-db | Migración compatible: `cash_registers` + `open_marker` único por caja | ENTREGADO — SQLite 11/11 + **MariaDB real 32/32** |
| M-W2-DB-02 | hs-db | Migración correctiva `opened_at` (ON UPDATE implícito) + enum `paper_kind` portrait | ENTREGADO — MariaDB real 42/42; deja 1 brecha de integración |
| M-W2-RCP-03 | hs-receipts | Seeder debe sembrar `letter_portrait`/`a4_portrait` nativos (instalación nueva) | **ENTREGADO** — instalación nueva y existente con hash idempotente; `PaperSize` unificado |

## Revisiones independientes

| ID | Objeto | Estado |
|----|--------|--------|
| RV-M-W1-BK-01 | Entrega backups | REQUIERE_CAMBIOS (H-01/H-02 media) → corregido |
| RV-M-W1-BK-01-R2 | Re-verificación del fix | **ACEPTABLE** (reprodujo 131/756/13 exit 0; SHA-256 coincide) |
| RV-M-W1-SEC-01 | Entrega seguridad | **ACEPTABLE** (F3 cerrado como falso positivo: `pnpm audit` = 0) |

## Hallazgos de la coordinación (verificados en código)

| ID | Hallazgo | Clasificación | Destino |
|----|----------|---------------|---------|
| COORD-03 | `accessibility.spec.ts:170` y `production-readiness.spec.ts:1130` esperan heading "control ejecutivo" inexistente; el UI real usa "Resumen del período" | PERSISTE — spec obsoleta, no regresión de UI | hs-qa (M-W1-QA-02) |
| COORD-11 | **REGRESIÓN REAL**: `InstitutionalReceiptPaymentIntegrationTest.php:137` — segundo pago (transferencia) devuelve 403 en MariaDB y pasa en SQLite; apunta a `InvoiceAccess::wasIssuedDuringCurrentOperationalDay` y depende de `Carbon::setTestNow` | CONFIRMADO por hs-qa, causa raíz sin aislar | hs-finance (M-W2-FIN-02) |
| COORD-12 | Job CI `backend-mariadb` ROJO: 7 fallos por contaminación de orden (`RefreshDatabase` + DDL con commit implícito) | CONFIRMADO | hs-qa (M-W1-QA-02) |
| COORD-13 | `tests/Concurrent` no lo corre ninguna testsuite | **RESUELTO**: contiene solo *workers*, no clases de test; los tests reales están en `tests/Feature/Concurrent/` y **sí** se descubren (9 listados) | — |
| COORD-14 | **GAP REAL**: `phpunit.mysql.xml` no define la testsuite `Console` que sí tiene `phpunit.xml` → el job MariaDB omite las pruebas de consola | CONFIRMADO por el coordinador | hs-qa (M-W1-QA-02) |
| COORD-15 | Error de sintaxis reportado 2 veces en `CashSessionConcurrencyTest.php:254` | **NO REPRODUCIBLE** (`--list-tests` exit 0, 1262 tests, 6 descubiertos) → ruido de edición concurrente; no propagar | — |
| COORD-04 | `OpenCashSessionAction` con check global de caja | PERSISTE → en corrección | hs-db + hs-finance |
| COORD-05 | `.dockerignore` re-incluía `frontend/.env.production` | CORREGIDO por el coordinador (idéntico por `base.ts:234`) | — |
| COORD-06 | Lockfiles duales en frontend (`pnpm` canónico + `package-lock.json` residual); `pnpm-workspace.yaml` sin `packages` | Deuda de higiene | hs-release / hs-frontend |
| COORD-07 | `cash_register_sessions.opened_at` con `ON UPDATE current_timestamp()` implícito en MariaDB: cerrar una sesión corrompía la hora de apertura | CONFIRMADO por hs-db sobre DDL real → en corrección | hs-db (M-W2-DB-02) + hs-finance (preserva `getOriginal`) |
| COORD-08 | **MariaDB 10.4.32 (XAMPP) disponible localmente** — permite verificación real de DDL/locks/FK, no solo SQLite | DESBLOQUEA verificación real | hs-qa / hs-finance |
| COORD-09 | E2E a reparar por cambios legítimos: `print-profiles.spec.ts` `/^Carta\b/i` ambiguo por "Carta vertical"; falta handler de `/test-preview` y mock de `/sanctum/csrf-cookie` en 11 specs | PERSISTE — specs obsoletas a reparar (no borrar) | hs-qa |
| COORD-10 | `ReceiptPrintProfileSeeder` sembraba `custom_mm` en instalación nueva pese al enum nativo | Brecha de integración detectada por hs-db → en corrección | hs-receipts (M-W2-RCP-03) |

## Bloque D/E/F

- D: LAN segundo cliente, operación diaria, estado del sistema, alertas sin Internet.
- E: rendimiento p50/p95 con dataset sintético declarado; polish visual con ambas skills.
- F: congelación + hashes, `HANDOFF_ACTUAL_CHATGPT.md` final, 4 estados.

## Blockers conocidos / pendientes externos

- Daemon Docker **apagado** → sin `docker load`, `compose up`, `nginx -t`, drill real, LAN.
- `installer-output/` inexistente → sin `.exe` ni hash de candidato.
- Impresora física, VM Windows limpia, segunda PC LAN, firma de código, destino externo
  USB/NAS, licencia Docker Desktop (decisión institucional) → NOT VERIFIED.
- `frontend/.env.production` versionado y des-ignorado en `.dockerignore:42` (valor
  actual público/vacío) → remediación pendiente (SEC-01-F1).

---

## Continuación C1 (2026-09-17) — ESTADO VIGENTE

Fingerprint de partida: `1713bd59ec0a076b01de07461559550a3d4fac9e` (idéntico al del cierre →
el árbol no cambió entre campañas). HEAD `baa41f97…`, 285 rastreados modificados + 124 no rastreados.

| Tarea | Agente | Sesión real | Estado |
|---|---|---|---|
| `M-W2-FE-04` superficie del consolidado | hs-frontend | `ses_f4eba7b8affePPaKhmiQZEux8V` | EN CURSO |
| `C1-FIN-01` contrato financiero del consolidado | hs-finance | `ses_f4eba7ba8ffep98wKBIFPLqgg5` | EN CURSO |
| `C1-INST-01` runtime Docker y laboratorio | hs-install | `ses_f4eba7babffe78o5txp2XYvjZK` | EN CURSO |
| `C1-RCP-01` impresión y caminos heredados | hs-receipts | `ses_f4eba7b88ffeq4o3CHl5H053PQ` | EN CURSO |
| `C1-REL-01` manifiesto y reconstrucción | hs-release | `ses_f4eba7b87ffemL2RPLnc06tSzW` | EN CURSO |
| `C1-QA-01` paridad de motor y skips | hs-qa | `ses_f4eba7b85ffeWvidFcM0QXk4jU` | EN CURSO |

### Cerrado en la fase anterior y RECONCILIADO (no reabrir por registro antiguo)

| Tarea | Estado vigente | Evidencia |
|---|---|---|
| `M-W1-QA-02` | ENTREGADO (tope de pasos; su fix de aislamiento **sí** funcionó) | suite MariaDB completa 1260/8649/65 exit 0 |
| `M-W2-DB-03` (+R2) | ENTREGADO; revisión REQUIERE_CAMBIOS solo en evidencia y corregida | migración `000006`; hash de filas idéntico; tabla cifra→fuente |
| `M-W2-RCP-04` | ENTREGADO | 3 rutas de timestamps; RED→GREEN en MariaDB |
| `M-W2-FIN-02` (+FIN-03, FIN-04) | ENTREGADO | causa raíz `issued_at`; consolidado; PHPStan 0 |
| `RV-M-W2-TS-01` H3/H4/H5 | RESUELTAS por `M-W2-FIN-03` | grupo `null` probado; centavos; semántica de rango documentada |
| `COORD-04`, `COORD-07`, `COORD-09`, `COORD-10`, `COORD-14` | CORREGIDOS | caja por registro; `opened_at`; specs E2E 49/0; seeder nativo; testsuite `Console` |
