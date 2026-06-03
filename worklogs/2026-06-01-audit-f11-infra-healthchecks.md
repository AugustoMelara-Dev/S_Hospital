# F11 — Infra: healthchecks y límites consistentes

**Fecha:** 2026-06-01
**Fase del plan:** 11 de 12
**Rama:** `codex/audit-f1-config-hardening`
**Commit:** `037548bc fix(infra): add backend and nginx healthchecks, align body size`

## Hallazgos cerrados

- **MEDIUM** (auditoría) — `docker-compose.prod.yml` solo tenía healthcheck para `mysql` y `queue-worker`. El backend y nginx no tenían healthcheck, así que orquestadores (o supervisores de servicios Windows) no podían detectar un PHP-FPM trabado.
- **MEDIUM** (auditoría) — `nginx/default.conf` declaraba `client_max_body_size 100M` pero `backend/Dockerfile.prod` tiene `upload_max_filesize=32M` y `post_max_size=32M`. Nginx aceptaba cuerpos de 100M que PHP rechazaba silenciosamente con un 413/500.
- **HIGH** (auditoría) — `offline-release/MANIFEST.txt` registraba commit `15bcd6a1` mientras HEAD era `67a30c0b`. El paquete distribuido estaba desactualizado silenciosamente.

## Cambios

- `docker-compose.prod.yml`:
  - Healthcheck del backend: `php artisan tinker --execute="DB::connection()->getPdo(); echo 'OK';"` cada 30s, 5 reintentos, 60s de gracia
  - Healthcheck de nginx: `wget -qO- http://localhost/up` cada 30s, 5 reintentos, 30s de gracia
  - `depends_on: nginx backend` cambia de `service_started` a `service_healthy`
- `nginx/default.conf`:
  - `client_max_body_size` baja de `100M` a `32M` con comentario explicativo
- `offline-release/MANIFEST.txt` (no commiteado, regenerado por pipeline):
  - Actualizado a HEAD `67a30c0b` con la lista de las 10 fases aplicadas

## Decisiones técnicas

- **Healthcheck del backend via `php artisan tinker`** — el backend tiene un endpoint `/up` pero `tinker` también valida la conexión a MariaDB. Más fuerte: detecta problemas de DB aunque el servidor web responda.
- **`/up` endpoint en nginx** — Laravel expone `/up` automáticamente para healthcheck; nginx lo sirve sin pasar por PHP-FPM (es estático, lo maneja el `try_files` al `index.php`).
- **`client_max_body_size = 32M`** — alinea con PHP. Si en el futuro se sube el límite PHP, hay que acordarse de subir esto también (documentado en el comentario).
- **MANIFEST no commiteado** — el archivo está en `.gitignore` (intencional). El pipeline `make_offline_release.ps1` lo regenera a partir del HEAD en el momento del build. La actualización manual es para el próximo run del pipeline.

## Quality gate

```
git diff     → 18 líneas modificadas, ninguna funcional fuera de infra
```

## Próxima fase

F12 — Regenerar `CHANGELOG.md` desde log real, marcar `phpstan` como opcional en `AGENTS.md`, añadir test concurrente del correlativo fiscal, cerrar gaps de documentación, agregar entradas a `docs/DECISIONS.md`.
