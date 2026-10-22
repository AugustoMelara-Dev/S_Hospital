# ESTADO — Campaña S_Hospital (coordinador hs-orchestrator)

## Entorno verificado (2026-09-18)

- Raíz escribible: `C:\Projects\S_Hospital_AI` (worktree aislado, detached).
  Origen intocable: `C:\Projects\S_Hospital` (`source_repo` en WORKSPACE.json).
- HEAD: `baa41f97310a578f8fd417a1e9b4b5d06c380670` (0 commits creados).
- Modelo: `opencode-go/deepseek-v4.1-flash` (conservado). Los doce `hs-*` activos.
- Skills instaladas y **leídas por autores y revisores**: `.agents/skills/better-ui/`
  y `.agents/skills/emil-design-eng/`.
- Encargo vigente: `hospital-ai/MANDATO_DEFINITIVO.md` + `hospital-ai/r2/*` (R2).
  El paquete R2 está copiado dentro del repo para que los especialistas puedan leerlo.

### Recursos (incidencia resuelta)

`com.docker.backend` retenía **1.988 MB** con el motor **roto** (`docker info` → 500),
dejando la RAM libre en **1,0 GB**: dos tareas murieron con `uv_spawn` y PowerShell falló
con *"el archivo de paginación es demasiado pequeño"* (0x800705AF). Se cerraron los
procesos de la **aplicación** Docker Desktop — **sin** `wsl --unregister`, sin tocar
distribuciones, discos, volúmenes ni imágenes (ver `DECISIONES.md#14`).
Resultado: **RAM libre 3,0 GB**, cero procesos Docker, WSL intacto.

## Laboratorio

- **Principal (compartido):** backend `http://127.0.0.1:18080`, frontend `http://127.0.0.1:15173`,
  base `sh_ai_lab_local`, usuario sintético `admin.validacion` / `Password123!`.
  Arranque: `scripts\lab_local_up.ps1`. Apagado: **siempre** `scripts\lab_local_down.ps1`.
- **Recibos:** base desechable `sh_ai_rcp01_lab` + `backend/.env.rcp01` (ya ignorado por git).
- **MariaDB 11.4.3 nativo** (aislado, puerto 3399) para paridad de motor: **no confundir con
  la imagen de despliegue**; su evidencia está en `evidencia/C1-QA-01/`.
- XAMPP MariaDB 10.4.32 en 3306, **compartido**; nunca se detiene ni se tocan bases ajenas.

## R2 — estado por frente

| Frente | Responsable | Estado | Evidencia |
|---|---|---|---|
| **EPO de extremo a extremo** | coordinador | ✅ **ALL PASSED** (backend+base reales) y **re-verificado independientemente por hs-qa (10/10)** | `evidencia/R2-EPO-E2E/RESULTADO.md`, `run1/epo-e2e-summary.json` |
| Contrato monetario POS (P0) | hs-frontend | ✅ corregido; `typecheck`/`lint` en 0; suite 172/1333 sin fallos (antes 2) | `evidencia/R2-MONEY-FE/**` |
| Prevalidación del servidor | hs-finance | ✅ `POST /api/invoices/preview` sin consumir correlativo | `evidencia/R2-MONEY-BE/CONTRATO_PREVALIDACION.md` |
| Recibo 612×792 desde el flujo normal | hs-receipts | ✅ medido por el coordinador (antes 612×396, texto 5,2–8,5 pt) | `evidencia/R2-RCP-01/RESULTADO_MEDIDO.md` |
| Recibos: defecto 6, copias, preview, plantilla | hs-receipts | 🔄 en curso | — |
| Rediseño estructural (40 criterios, base **10/40**) | hs-frontend | 🔄 en curso (**20 tests en rojo temporalmente**) | `diseno/PLAN_ESTRUCTURAL_R2.md`, `evidencia/R2-UX-01/tools/measure-r2.mjs` |
| Generadores XLSX/PDF | **hs-finance (asignado)** | 🔄 en curso | — |
| Higiene de pruebas y runners | hs-qa | ✅ entregado (falta un intento de navegador) | `evidencia/R2-QA-01/**` |
| Segunda pasada visual | hs-ux | ⏳ tras el montaje estructural | — |
| Veredictos independientes | hs-review | ⏳ por frente estabilizado | — |

### Deuda obligatoria antes de cerrar R2

1. **20/34 tests de `NewInvoiceView.test.tsx` en rojo** por el cambio de label a "Paciente"   durante el rediseño en curso. Es esperable a mitad del refactor, pero **R2 no cierra con
   la suite en rojo**. Verificación del coordinador al integrar.
2. **Selector "Copias" vacío**, estado "sucio" falso, fuente única del conteo, preview del
   borrador y plantilla (frente de hs-receipts).
3. **Test de backend `InstitutionalReceiptGlobalDefaultProfileTest`** en rojo: debe resolverse
   por contrato (producto o test), no declararse obsoleto porque falla.
4. **Exportaciones**: XLSX `D4` como porcentaje, PDF con encabezados no huérfanos e
   identificadores de caja/sesión.
5. **40 criterios** de `measure-r2.mjs` por encima de la línea base 10/40, con medición final.

### Pendientes externos (no se simulan)

Impresora física · VM Windows limpia · segunda PC LAN · firma de código · destino externo de
respaldo y custodia · licencia de Docker Desktop (entidad gubernamental) · `APP_ENV=production`
con configuración fiscal real.

## Cómo continuar

1. Verificar suite, build y los 40 criterios con el árbol quieto.
2. hs-ux: segunda pasada renderizada (antes/después del mismo recorrido, zoom real, teclado,
   contraste, `prefers-reduced-motion`).
3. hs-review: veredicto independiente por frente estabilizado.
4. Regenerar el manifiesto (`hospital-ai/release/`) y **solo entonces** congelar.
