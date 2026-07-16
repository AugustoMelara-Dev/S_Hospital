# Test Artifact Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evitar que PHPUnit contamine el worktree y hacer permanente esa garantía en CI.

**Architecture:** El fixture local de `SystemStatusTest` vivirá en el directorio temporal del sistema y se eliminará mediante el ciclo de vida de Laravel. El job SQLite verificará la limpieza del checkout inmediatamente después de PHPUnit.

**Tech Stack:** PHP 8.2, Laravel 12, PHPUnit 11, GitHub Actions, Git.

## Global Constraints

- No modificar fixtures históricos rastreados en `backend/storage/framework`.
- No añadir rutas a `.gitignore` para ocultar residuos.
- Preservar `frontend/package-lock.json`.
- Mantener la fase separada de cualquier cambio funcional.

---

### Task 1: Proteger el gate de limpieza CI

**Files:**
- Modify: `backend/tests/Unit/WindowsInstallSecretsTest.php`
- Test: `backend/tests/Unit/WindowsInstallSecretsTest.php`

**Interfaces:**
- Consumes: texto de `.github/workflows/ci.yml`.
- Produces: `test_ci_checks_backend_worktree_clean_immediately_after_phpunit()`.

- [x] **Step 1: Añadir la regresión de contrato**

```php
public function test_ci_checks_backend_worktree_clean_immediately_after_phpunit(): void
{
    $workflow = file_get_contents(base_path('../.github/workflows/ci.yml'));

    $this->assertIsString($workflow);
    $phpunit = strpos($workflow, '- name: Run PHPUnit');
    $cleanGate = strpos($workflow, '- name: Assert backend tests leave worktree clean');
    $pint = strpos($workflow, '- name: Run Pint code style');

    $this->assertNotFalse($phpunit);
    $this->assertNotFalse($cleanGate);
    $this->assertNotFalse($pint);
    $this->assertGreaterThan($phpunit, $cleanGate);
    $this->assertLessThan($pint, $cleanGate);
    $this->assertStringContainsString('git status --porcelain --untracked-files=all', $workflow);
}
```

- [x] **Step 2: Ejecutar RED**

Run: `php artisan test --filter=test_ci_checks_backend_worktree_clean_immediately_after_phpunit --colors=never`

Expected: FAIL porque el paso todavía no existe.

### Task 2: Aislar el fixture local

**Files:**
- Modify: `backend/tests/Feature/SystemStatusTest.php`
- Test: `backend/tests/Feature/SystemStatusTest.php`

**Interfaces:**
- Consumes: `sys_get_temp_dir()` y lifecycle `beforeApplicationDestroyed`.
- Produces: ruta única `s-hospital-testing-local-mode-status-*` eliminada al finalizar.

- [x] **Step 1: Sustituir la ruta dentro del repositorio**

```php
$proofRoot = sys_get_temp_dir().DIRECTORY_SEPARATOR.'s-hospital-testing-local-mode-status-'.bin2hex(random_bytes(8));
$this->beforeApplicationDestroyed(fn () => File::deleteDirectory($proofRoot));
```

Conservar la creación del frontend simulado y el resto de las aserciones.

- [x] **Step 2: Verificar aislamiento**

Run: `php artisan test --filter=test_loopback_app_url_is_treated_as_local_single_machine_mode --colors=never`

Expected: PASS, 1 test / 15 assertions.

Run: `git status --porcelain --untracked-files=all -- backend/storage/framework/testing-local-mode-status`

Expected: sin salida.

### Task 3: Añadir el gate CI

**Files:**
- Modify: `.github/workflows/ci.yml`
- Test: `backend/tests/Unit/WindowsInstallSecretsTest.php`

**Interfaces:**
- Consumes: estado Git posterior a PHPUnit.
- Produces: fallo legible de CI ante cualquier residuo no ignorado.

- [x] **Step 1: Insertar el paso después de PHPUnit**

```yaml
      - name: Assert backend tests leave worktree clean
        run: |
          if [ -n "$(git status --porcelain --untracked-files=all)" ]; then
            echo "Backend tests left tracked changes or untracked files:"
            git status --short --untracked-files=all
            exit 1
          fi
```

- [x] **Step 2: Ejecutar GREEN y estilo**

Run: `php artisan test --filter=WindowsInstallSecretsTest --colors=never`

Expected: PASS, 4 tests.

Run: `php vendor/bin/pint --test tests/Feature/SystemStatusTest.php tests/Unit/WindowsInstallSecretsTest.php`

Expected: Pint PASS.

- [x] **Step 3: Verificar diff y commit**

Run: `git diff --check` y `git status --short`.

Expected: solo archivos de esta fase más el lockfile ajeno sin stage.

Commit: `test(ci): enforce clean backend test worktree`
