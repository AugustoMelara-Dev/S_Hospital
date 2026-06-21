# Dependency security audit - 2026-06-20

## Resultado
- Backend Composer: PASS despues de actualizar lockfile.
- Frontend npm runtime/dev: PASS.
- Produccion Docker: PASS, imagen reconstruida y servicios backend/queue-worker/scheduler recreados.

## Hallazgo cerrado
- `guzzlehttp/guzzle` estaba en `7.11.1` y `composer audit` reportaba:
  - `CVE-2026-55767` / `PKSA-93qv-9n9h-6k6p` / Dot-only cookie domains match all hosts.
  - `CVE-2026-55568` / `PKSA-k22t-f949-t9g6` / Silent HTTPS proxy downgrade to cleartext.
- `guzzlehttp/psr7` estaba en `2.11.0` y `composer audit` reportaba:
  - `CVE-2026-55766` / `PKSA-7qs6-zvnz-h66r` / CRLF injection in HTTP start-line serialization.

## Correccion aplicada
- `backend/composer.lock`: `guzzlehttp/guzzle` actualizado a `7.12.1`.
- `backend/composer.lock`: `guzzlehttp/psr7` actualizado a `2.12.1`.
- No hubo cambios en `backend/composer.json`.
- Se reconstruyeron imagenes Docker `backend`, `queue-worker` y `scheduler` con el lockfile actualizado.

## Evidencia ejecutada
```powershell
docker run --rm -v "C:\Projects\S_Hospital\backend:/app" -w /app composer:2 composer validate --no-interaction --strict
# ./composer.json is valid

docker run --rm -v "C:\Projects\S_Hospital\backend:/app" -w /app composer:2 composer audit --no-interaction --locked
# No security vulnerability advisories found.

cd C:\Projects\S_Hospital\frontend
npm.cmd audit --omit=dev --audit-level=high
# found 0 vulnerabilities
npm.cmd audit --audit-level=high
# found 0 vulnerabilities

docker compose -p shospital_offlinetest -f docker-compose.prod.yml --env-file C:\tmp\s_hospital_offlinetest.env build backend queue-worker scheduler
# build OK, instala guzzlehttp/guzzle 7.12.1 y guzzlehttp/psr7 2.12.1

docker compose -p shospital_offlinetest -f docker-compose.prod.yml --env-file C:\tmp\s_hospital_offlinetest.env up -d --no-deps backend queue-worker scheduler
# backend, queue-worker y scheduler recreados sin tocar MariaDB

docker compose -p shospital_offlinetest -f docker-compose.prod.yml --env-file C:\tmp\s_hospital_offlinetest.env exec -T backend sh -lc 'grep -A3 guzzlehttp/guzzle vendor/composer/installed.json; grep -A3 guzzlehttp/psr7 vendor/composer/installed.json'
# guzzlehttp/guzzle 7.12.1
# guzzlehttp/psr7 2.12.1

powershell -NoProfile -ExecutionPolicy Bypass -File scripts\quality_gate_windows.ps1 -CriticalOnly
# WINDOWS_QUALITY_GATE_PASSED
```

## Nota operativa
`composer audit` sin `--locked` puede leer `backend/vendor` local si existe. En esta PC ese `vendor` local estaba desactualizado e ignorado por Git. La evidencia valida el lockfile y el contenedor productivo reconstruido, que son las fuentes efectivas para produccion Docker.
