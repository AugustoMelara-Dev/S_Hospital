# Central Supply-Chain Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bloquear todos los installs CI detrás de un único preflight de locks y auditar Composer antes de ejecutar código instalado.

**Architecture:** Un job raíz sin dependencias valida la herramienta y los locks. Tres jobs consumidores declaran `needs`; sus instalaciones siguen corriendo en paralelo. Composer audita el lock antes de instalar.

**Tech Stack:** GitHub Actions, PowerShell, Composer, pnpm, PHPUnit.

## Global Constraints

- No cambiar dependencias, locks ni scripts Composer.
- No serializar backend/frontend después del preflight.
- Conservar escaneo postinstall frontend.
- Preservar cambios del usuario.

---

### Task 1: Añadir contratos RED

**Files:**
- Modify: `backend/tests/Unit/WindowsInstallSecretsTest.php`

- [x] Exigir job central con self-test y guard ordenados.
- [x] Exigir `needs: supply-chain` en los tres jobs instaladores.
- [x] Exigir audit Composer locked antes de install en ambos backends.
- [x] Ajustar contrato frontend a install → guard postinstall → audit.
- [x] Ejecutar tests focalizados y observar RED.

### Task 2: Implementar workflow y documentación

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `docs/CI.md`
- Modify: `docs/SECURITY_SUPPLY_CHAIN_RUNBOOK.md`

- [x] Crear job `supply-chain` y dependencias `needs`.
- [x] Eliminar preflight duplicado del job frontend.
- [x] Mover audits Composer y añadir `--locked`.
- [x] Documentar cinco jobs y barrera preinstall.

### Task 3: Verificar y commitear

- [x] Ejecutar self-test, guard real y pnpm audit.
- [x] Ejecutar contrato CI, YAML semántico y Pint.
- [x] Ejecutar `git diff --check` y preservar lockfile ajeno.
- [x] Crear `security(ci): gate installs behind lock preflight`.
