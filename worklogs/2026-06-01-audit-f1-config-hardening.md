# F1 — Producción: defaults de BD y cola hardenizados

**Fecha:** 2026-06-01
**Fase del plan:** 1 de 12
**Rama:** `codex/audit-f1-config-hardening`
**Commit:** `4282c843 fix(backend): harden production defaults for DB and queue`

## Hallazgos cerrados

- **CRÍTICO** `backend/config/database.php:20` — `default` cambiaba a `env('DB_CONNECTION', 'sqlite')` silenciosamente. Si el operador olvidaba exportar `DB_CONNECTION`, el sistema arrancaba con SQLite. Ahora el fallback es `mysql`, alineado con el requisito de AGENTS.md y `.env.example`.
- **CRÍTICO** `backend/config/queue.php:44,53,64,73` — `after_commit` estaba en `false` para los drivers `database`, `beanstalkd`, `sqs` y `redis`. Los jobs despachados dentro de una transacción quedaban huérfanos si la transacción hacía rollback. Cambiado a `true` siguiendo la recomendación oficial de Laravel 11+.

## Cambios

- `backend/config/database.php` — fallback `sqlite` → `mysql`.
- `backend/config/queue.php` — `after_commit` → `true` en 4 conexiones (sync no aplica).
- `backend/tests/Unit/ProductionConfigDefaultsTest.php` (nuevo) — 3 tests de regresión que parsean los archivos de config y verifican que los defaults siguen siendo los correctos.

## Decisiones técnicas

- **No usar `Schema::hasColumn` ni `Config::set` en el test** — se optó por parseo de strings de los archivos de config para que el test sea estable y no requiera bootstrapping de Laravel con env sobreescrito. Esto protege contra reverts accidentales.
- **Mantener `sync` sin `after_commit`** — el driver `sync` ejecuta inmediatamente y no tiene semántica de cola diferida, así que no aplica.
- **No tocar `CloseCashSessionAction`** — ya usaba `DB::afterCommit` explícitamente. Con `after_commit: true` global, esa llamada se vuelve redundante pero no rompe nada. Limpieza se hará en F4 (policies) si la rúbrica de DRY lo amerita.

## Quality gate

```
phpunit      → 242 tests, 1670 assertions OK
pint         → passed
```

## Riesgos

- **Bajo.** Los tests phpunit fuerzan `DB_CONNECTION=sqlite` y `QUEUE_CONNECTION=sync` vía `force="true"`, así que el cambio de default no afecta a la suite de tests.
- **Bajo.** El cambio de `after_commit: true` afecta únicamente a jobs despachados DENTRO de una transacción. El `BackupController::store` despacha fuera de transacción → no se ve afectado. El `CloseCashSessionAction` ya usaba `DB::afterCommit` → la combinación con el flag global es segura (el callback se ejecuta después del commit y el job se despacha fuera de cualquier transacción activa).

## Próxima fase

F2 — XSS en `PdfExportService`: aplicar `htmlspecialchars` a todos los strings controlados por el usuario antes de inyectarlos en el HTML del PDF.
