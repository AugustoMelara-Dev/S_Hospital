# CI Workflow Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restaurar el arranque de GitHub Actions y evitar que vuelva a aceptarse un job con `services:` vacío.

**Architecture:** El workflow seguirá usando SQLite sin servicios en `backend-sqlite` y MariaDB como servicio explícito en `backend-mariadb`. La regresión vive en el test PHP existente que ya audita contratos de CI, sin añadir un parser o dependencia nueva.

**Tech Stack:** GitHub Actions YAML, PHPUnit 11, Laravel 12, PHP 8.2.

## Global Constraints

- Preservar `frontend/package-lock.json` y todo cambio preexistente del usuario.
- No cambiar funcionalidad hospitalaria ni dependencias.
- Usar TDD: observar RED antes de editar el workflow.
- Mantener la fase pequeña y apta para un commit `fix(ci): reject empty workflow services`.

---

### Task 1: Proteger el contrato de servicios del workflow

**Files:**
- Modify: `backend/tests/Unit/WindowsInstallSecretsTest.php`
- Test: `backend/tests/Unit/WindowsInstallSecretsTest.php`

**Interfaces:**
- Consumes: contenido textual de `.github/workflows/ci.yml`.
- Produces: regresión `test_ci_workflow_does_not_define_empty_service_maps()`.

- [x] **Step 1: Añadir la prueba que detecta un bloque `services:` vacío**

```php
public function test_ci_workflow_does_not_define_empty_service_maps(): void
{
    $workflow = file_get_contents(base_path('../.github/workflows/ci.yml'));

    $this->assertIsString($workflow);
    $lines = preg_split('/\R/', $workflow);

    $this->assertIsArray($lines);
    foreach ($lines as $index => $line) {
        if (preg_match('/^(?<indent>[ ]*)services:[ ]*$/', $line, $matches) !== 1) {
            continue;
        }

        $serviceIndent = strlen($matches['indent']);
        $nextEntryIndent = null;
        for ($candidate = $index + 1; $candidate < count($lines); $candidate++) {
            $nextLine = $lines[$candidate];
            if (trim($nextLine) === '' || str_starts_with(ltrim($nextLine), '#')) {
                continue;
            }

            preg_match('/^(?<indent>[ ]*)/', $nextLine, $nextMatches);
            $nextEntryIndent = strlen($nextMatches['indent']);
            break;
        }

        $this->assertNotNull($nextEntryIndent, 'Every services map must contain a service entry.');
        $this->assertGreaterThan(
            $serviceIndent,
            $nextEntryIndent,
            'GitHub Actions rejects jobs whose services map is empty.',
        );
    }
}
```

- [x] **Step 2: Ejecutar la prueba y comprobar RED**

Run: `php artisan test --filter=test_ci_workflow_does_not_define_empty_service_maps --colors=never`

Expected: FAIL con `GitHub Actions rejects jobs whose services map is empty.`

### Task 2: Corregir el workflow

**Files:**
- Modify: `.github/workflows/ci.yml`
- Test: `backend/tests/Unit/WindowsInstallSecretsTest.php`

**Interfaces:**
- Consumes: contrato protegido en Task 1.
- Produces: job `backend-sqlite` sin clave `services`; job `backend-mariadb` sin cambios.

- [x] **Step 1: Eliminar el mapa vacío**

Eliminar únicamente:

```yaml
    services:
      # MariaDB only for the e2e health-check job below; sqlite is the
      # default for the unit + feature suite.
```

- [x] **Step 2: Ejecutar la prueba y comprobar GREEN**

Run: `php artisan test --filter=WindowsInstallSecretsTest --colors=never`

Expected: PASS, 3 tests.

- [x] **Step 3: Validar estructura y estilo**

Run: `php vendor/bin/pint --test tests/Unit/WindowsInstallSecretsTest.php`

Expected: `{"tool":"pint","result":"passed"}`.

Run: `python -c "import yaml; from pathlib import Path; data=yaml.safe_load(Path('.github/workflows/ci.yml').read_text()); assert 'services' not in data['jobs']['backend-sqlite']; assert 'mariadb' in data['jobs']['backend-mariadb']['services']"`

Expected: exit 0.

- [x] **Step 4: Revisar el diff y el estado**

Run: `git diff --check` y `git status --short`

Expected: sin errores de whitespace; `frontend/package-lock.json` permanece sin incluir en esta fase.
