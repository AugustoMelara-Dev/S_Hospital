# Frontend CI Security And Bundle Budget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Impedir que vulnerabilidades frontend de alto impacto o regresiones del presupuesto de bundle lleguen a `main` sin señal en CI.

**Architecture:** El job frontend conservará una única instalación y build. La auditoría se ejecutará antes de los gates de código; el analizador de bundle reutilizará `dist` después del build. Un test PHP de contrato inspeccionará solo ese job y su orden.

**Tech Stack:** GitHub Actions, pnpm 11, Vite, PHP 8.2, PHPUnit.

## Global Constraints

- No agregar dependencias ni duplicar límites de bundle.
- No ocultar errores de consulta del registro.
- No modificar ningún lockfile.
- Mantener esta fase separada de cambios funcionales.

---

### Task 1: Añadir el contrato CI en RED

**Files:**
- Modify: `backend/tests/Unit/WindowsInstallSecretsTest.php`
- Test: `backend/tests/Unit/WindowsInstallSecretsTest.php`

- [x] Extraer el bloque `frontend` entre los jobs frontend y E2E.
- [x] Exigir instalación → auditoría → typecheck y build → presupuesto.
- [x] Exigir los comandos exactos y prohibir `--ignore-registry-errors`.
- [x] Ejecutar el test focalizado y observar RED por pasos ausentes.

### Task 2: Implementar gates y documentación

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `docs/CI.md`

- [x] Insertar `Audit frontend dependencies` después de la instalación.
- [x] Insertar `Enforce bundle budget` después del build.
- [x] Corregir la tabla y la descripción de seguridad de CI.
- [x] Mantener intactos los comandos Docker locales que usan npm.

### Task 3: Verificar y commitear

- [x] Ejecutar el test contractual completo.
- [x] Validar semánticamente el YAML.
- [x] Ejecutar `pnpm audit --audit-level high`.
- [x] Ejecutar build y presupuesto de bundle.
- [x] Ejecutar Pint sobre el test modificado y `git diff --check`.
- [x] Confirmar que `frontend/package-lock.json` permanece fuera del stage.
- [x] Crear `ci(frontend): enforce security and bundle budgets`.
