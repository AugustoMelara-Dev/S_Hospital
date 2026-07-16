# Pnpm Build Policy And Preinstall Scan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que la instalación pnpm 11 de CI sea segura, reproducible y ejecutable, bloqueando IOCs antes de cualquier build de dependencia.

**Architecture:** Una allowlist declarativa autorizará solo esbuild. El job ejecutará self-test y guard preinstall, instalación congelada, guard postinstall y audit. PHPUnit protegerá configuración y orden.

**Tech Stack:** pnpm 11, PowerShell, GitHub Actions, PHPUnit.

## Global Constraints

- No modificar lockfiles ni dependencias.
- No permitir builds globalmente ni degradar errores a warnings.
- Mantener guard antes y después de instalar.
- Preservar el lockfile modificado por el usuario.

---

### Task 1: Añadir contratos RED

**Files:**
- Modify: `backend/tests/Unit/WindowsInstallSecretsTest.php`

- [x] Exigir `allowBuilds.esbuild=true` y negar relajaciones globales.
- [x] Exigir self-test → preinstall guard → install → postinstall guard → audit.
- [x] Ejecutar ambos tests y observar RED.

### Task 2: Implementar política y orden

**Files:**
- Create: `frontend/pnpm-workspace.yaml`
- Modify: `.github/workflows/ci.yml`
- Modify: `docs/CI.md`
- Modify: `docs/SECURITY_SUPPLY_CHAIN_RUNBOOK.md`

- [x] Añadir allowlist exclusiva de esbuild.
- [x] Mover self-test/primer guard antes de instalar.
- [x] Añadir guard de artefactos después de instalar.
- [x] Corregir documentación de política y archivos existentes.

### Task 3: Certificar instalación limpia

- [x] Copiar manifiesto, lock y política a una ruta temporal literal verificada.
- [x] Ejecutar instalación congelada y el binario esbuild del virtual store.
- [x] Limpiar únicamente esa ruta temporal después de verificarla.
- [x] Ejecutar self-test, guard real, audit, contrato CI, YAML, Pint y diff.
- [x] Crear `security(ci): approve only esbuild dependency build`.
