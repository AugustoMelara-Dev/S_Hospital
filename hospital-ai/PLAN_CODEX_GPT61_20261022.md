# PLAN CODEX — terminar S_Hospital (gpt-6.1-sol + subagentes)

Fecha: 2026-10-22 · Preparado por Claude (auditor). Sustituye a DeepSeek como
ejecutor. El plan base sigue siendo `hospital-ai/PLAN_DEEPSEEK_ENTREGA_20261021.md`
(fases, reglas y respuestas del propietario en §5B). Lea **AGENTS.md**, ese plan y
`hospital-ai/evidencia/ENTREGA-20261021/AUDITORIA_CLAUDE.md` antes de tocar nada.

Raíz: `C:\Projects\S_Hospital_AI` · Rama: `release/entrega-20261021` (no cambiar
de rama). `C:\Projects\S_Hospital` es intocable.

## 1. Estado al relevo (verificado por Claude)

Hecho y auditado (22 commits sobre `baa41f97`, `main` integrado):

- F0 consolidación, guard de secretos corregido con tests.
- F1 gates: frontend tsc/eslint/vitest 1241/build verdes; backend PHPStan 0,
  Pint OK, PHPUnit verde en SQLite y MariaDB 10.4 (PHP 8.3 del payload).
- F2 H-04/05/06/09/10 resueltos con test.
- F2B impuestos configurables: `tax_rates`, `services.tax_rate_id` (NULL = exento,
  única fuente), backfill de actualización, cálculo por línea con desglose,
  pestaña Ajustes → Impuestos, selector y lote en Catálogo, importar/exportar
  catálogo CSV/XLSX, aviso de revisar impuestos. Catálogo semilla exento.
- H-14/H-03: identidad neutra `S_Hospital`, payload sin datos de QA (test).
- F2C recibo: carta, media carta y térmica 80 mm **aprobados visualmente**;
  58 mm con un residual (A-10). PDFs en `hospital-ai/evidencia/ENTREGA-20261021/recibos/`.

En el árbol, **sin commitear** (de DeepSeek, legítimo, a continuar): aislamiento
de pruebas para MariaDB en 5 tests de `backend/tests` (A-11 en curso).

## 2. Pendiente

| ID | Qué | Prioridad |
|---|---|---|
| A-11 | Suite backend contra **MariaDB 11.4.13 del payload** (`artifacts/native-payload/runtime/mariadb`, instancia temporal en puerto libre, base desechable): **10 errores + 2 fallos**. Corregir causa por causa; en el producto si es del producto. Correr además las pruebas de concurrencia (`HOSPITAL_RUN_CONCURRENT_TESTS=1`): numeración fiscal, pago vs cierre de caja, reimpresión. | ALTA |
| A-09 | Lista de omitidos (`--display-skipped`) de la corrida MariaDB 11.4 con motivo; ninguna prueba de dinero/migración/FK/respaldo omitida sin sustituto. | MEDIA |
| A-10 | 58 mm: «Gravado 15 %» pegado al importe en totales con montos ≥ L 100,000. Bajar importe a su línea si no cabe. Regenerar PDF y revisarlo. | BAJA |
| A-01 | Quitar «Hospital San Isidro» del docblock de `ExecutivePdfExportService.php`. | BAJA |
| H-07 | Medir exportación Excel con el servidor real; si > 3 s con 100 facturas, perfilar. | MEDIA |
| F3 | Recorrido real completo con **build de producción** sobre el stack del payload (Caddy + PHP-FCGI 8.3 + MariaDB 11.4), roles admin/supervisor/cajero, flujo completo (ver plan base F3), Playwright `test:e2e:mock` y `test:e2e:release` verdes, impuestos mixtos y térmica desde Ajustes → Impresión. | ALTA |
| F4 | Construir instalador `.8` (ver `installer/native/README.md`), suites `scripts/native/*.test.ps1` y `scripts/certification/*.test.ps1` en PowerShell 5.1 verdes, SHA-256 y manifiesto. | ALTA |
| F5 | Instalar `.8` en esta PC sobre el `.6` roto (requiere **UAC del propietario**: pedirlo y esperar). Verificar servicios, admin, respaldo inicial, reinicio. | ALTA |
| F6 | Windows limpio: solo si hay VirtualBox; si no, documentar pendiente. | — |
| F8 | Guía actualizada (`GUIA_UNA_COMPUTADORA.md`, `LEEME.txt`): 2 hospitales, configurar identidad/impuestos/catálogo/impresora, ajustes del diálogo de impresión (escala 100 %, sin encabezados), SmartScreen, capturas de la identidad dark actual. `ENTREGA_ACTUAL` con lista exacta de lo no verificado. | MEDIA |

## 3. Paralelismo con subagentes (gpt-6.1-sol, medium)

Lance estos subagentes **a la vez**, cada uno con **dueño único** de sus archivos
(nadie toca archivos de otro). El coordinador integra, corre gates y commitea.

| Subagente | Archivos propios | Tarea |
|---|---|---|
| **mariadb** | `backend/app/**`, `backend/database/**`, `backend/tests/**` (excepto pruebas de recibos) | A-11 + A-09 + A-01 |
| **recibos** | `backend/resources/views/pdf/**`, `backend/tests/Feature/*Receipt*`, `backend/tests/Feature/Evidence/**`, `hospital-ai/evidencia/ENTREGA-20261021/recibos/**` | A-10; regenerar los 4 PDFs y renderizar PNG para revisión |
| **e2e** | `frontend/e2e/**`, `frontend/playwright*.ts`, `frontend/scripts/**` | Playwright mock y release verdes; recorrido por rol con capturas en `hospital-ai/evidencia/ENTREGA-20261021/F3/` |
| **instalador** | `scripts/**`, `installer/**` | Suites PS 5.1 verdes; preparar build `.8` (staging, payload, ISCC) **sin ejecutar el instalador** |
| **docs** | `hospital-ai/*.md` (no evidencia de otros), `docs/**` | F8 guía y entrega |

Orden de integración: mariadb + recibos → gates completos (SQLite + MariaDB 11.4 +
frontend) → e2e/F3 sobre stack real → instalador F4 → F5 (UAC) → docs F8.

Cuidado: dos suites PHPUnit no pueden correr a la vez (comparten
`storage/framework/testing` y `storage/app/private/backups`). Serializar las
corridas completas; los subagentes corren solo sus pruebas focales.

## 4. Reglas (no negociables)

- Sin `git push`, `reset --hard`, `clean`, `rebase`, `--no-verify`.
- Commits pequeños y coherentes (Conventional Commits) con el hook
  `git -c core.hooksPath=.githooks commit`.
- Sin binarios en git (`.exe`, `.zip`, `artifacts/`).
- Bases: solo laboratorio desechable. La instalación nativa de esta PC (servicios
  `SHospital*`, puerto 8000, MariaDB 3307) solo se toca en F5.
- Un test se cambia solo si quedó obsoleto, explicando el contrato vigente; si el
  producto está mal, se corrige el producto.
- Marcar cada A-xx como **Resuelto con commit** en `AUDITORIA_CLAUDE.md`.
- No preguntar salvo bloqueo real (UAC, hardware, decisión de negocio).
- Evidencia por fase en `hospital-ai/evidencia/ENTREGA-20261021/`.

## 5. Terminado

Rama con todo commiteado; gates verdes en SQLite, MariaDB 11.4 y frontend;
recorrido real por rol aprobado; `.exe` `.8` con SHA-256; instalado y reiniciado en
esta PC; guía actualizada; lista exacta de lo no verificado (Windows limpio,
impresora física, firma de código).
