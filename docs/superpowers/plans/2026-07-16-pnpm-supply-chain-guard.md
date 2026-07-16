# Pnpm Supply-Chain Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cubrir con el guard de indicadores el lockfile pnpm autoritativo de CI y ejecutar esa defensa de forma probada en Ubuntu/Windows.

**Architecture:** El guard mantendrá su política central existente y añadirá un lector mínimo de claves pnpm. Un self-test externo lanzará el guard como proceso hijo sobre fixtures temporales; CI ejecutará self-test y escaneo real antes del audit del registro.

**Tech Stack:** PowerShell 5.1/7, pnpm lockfile v9, GitHub Actions, PHPUnit.

## Global Constraints

- No añadir módulos PowerShell ni parsers YAML.
- No modificar los lockfiles reales.
- No escanear caches o temp del runner CI.
- Preservar el cambio del usuario en `frontend/package-lock.json`.

---

### Task 1: Crear fixtures RED para pnpm

**Files:**
- Create: `scripts/security/test-supply-chain-check.ps1`

- [x] Crear fixtures aislados con `package.json` vacío.
- [x] Exigir fallo para paquete universal y versión exacta prohibidos solo en
  `pnpm-lock.yaml`.
- [x] Exigir PASS para versiones seguras.
- [x] Ejecutar el self-test y observar RED porque el guard actual ignora pnpm.

### Task 2: Implementar parser y rutas multiplataforma

**Files:**
- Modify: `scripts/security/supply-chain-check.ps1`

- [x] Parsear claves pnpm con/sin scope, comillas y peers.
- [x] Deduplicar hallazgos nombre/versión.
- [x] Enumerar `pnpm-lock.yaml` fuera de dependencias instaladas.
- [x] Normalizar filtros y raíces para Windows/Linux.
- [x] Ejecutar self-test y guard real en GREEN.

### Task 3: Integrar y proteger CI

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `backend/tests/Unit/WindowsInstallSecretsTest.php`
- Modify: `docs/CI.md`
- Modify: `docs/SECURITY_SUPPLY_CHAIN_RUNBOOK.md`

- [x] Añadir contrato RED para orden y comandos de self-test/guard/audit.
- [x] Insertar ambos pasos PowerShell en el job frontend.
- [x] Documentar cobertura npm, pnpm y Composer.
- [x] Ejecutar contrato CI, parseo YAML, Pint y `git diff --check`.
- [x] Preparar solo archivos de esta fase y crear
  `security(ci): scan pnpm supply-chain indicators`.
