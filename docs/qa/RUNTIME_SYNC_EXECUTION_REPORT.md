# Runtime Sync Execution Report

Fecha local: 2026-06-25 23:40 America/Tegucigalpa

## Resumen

Estado: RUNTIME SINCRONIZADO.

La URL correcta para validacion visual y uso LAN de este stack es:

```text
http://192.168.1.10:8081
```

El stack recomendado `shospital_offlinetest` fue alineado a la IP LAN real `192.168.1.10`, reconstruido sin borrar volumenes y quedo sirviendo el build frontend fresco de `main`.

El stack `shospital_prodtest` en `8080` sigue activo y fue identificado como stack viejo/no recomendado. No se apago porque esta tarea no tenia autorizacion explicita para detenerlo.

## Git y ramas

- Rama base auditada: `main`
- SHA `main`: `6ba95fd0bd4334ae1a710ffc9d96d42fb8f6ecf3`
- SHA `origin/main`: `6ba95fd0bd4334ae1a710ffc9d96d42fb8f6ecf3`
- Rama de ejecucion: `codex/runtime-sync-execution`
- Auditoria integrada: `origin/codex/runtime-visual-sync-audit` (`df5fccc77564330ec3f7cac4cd6d45f1f5f6c8f7`)
- Merge local previo a este reporte: `8449f53f59c3ab1401f9b0178e440dbac9a8d02c`

## URL, stacks y puertos

| URL | Stack | Resultado |
| --- | --- | --- |
| `http://192.168.1.10:8081` | `shospital_offlinetest` | Correcto, sincronizado |
| `http://192.168.1.10:8080` | `shospital_prodtest` | Viejo/no recomendado |

Evidencia del navegador/runtime:

- Logs de nginx del stack `shospital_offlinetest` mostraron actividad de navegador en `http://192.168.1.10:8081/billing/new`.
- `netstat` no mostro conexiones TCP establecidas activas a `8080`/`8081` antes del rebuild, solo listeners.
- El entorno se trato como stack local de prueba (`offlinetest`); produccion fisica aprobada: NO.

## Backup previo

El comando documentado con `--manual` fallo porque esa opcion no existe en este checkout. El comando real validado es:

```powershell
docker compose --env-file C:\tmp\s_hospital_offlinetest.env -p shospital_offlinetest -f C:\Projects\S_Hospital\docker-compose.prod.yml exec -T backend php artisan hospital:backup --type=manual
```

Resultado:

- Archivo: `hospital-backup-20260625-233401-fu28j4kl.sql.enc`
- Estado: `success`
- Tamano: `4856526` bytes
- SHA256: `b335a578fe7329177828b732643e5295bc6f44a82b66e8377ea253e84edf067f`
- Completado: `2026-06-25 23:34:02`

## IP LAN antes/despues

Antes, `shospital_offlinetest` tenia:

```text
APP_URL=http://192.168.1.41:8081
SERVER_IP=192.168.1.41
APP_PORT=8081
SANCTUM_STATEFUL_DOMAINS=192.168.1.41,192.168.1.41:8081
CORS_ALLOWED_ORIGINS=http://192.168.1.41:8081,https://192.168.1.41:8081
SOKETI_PORT=6003
PUSHER_CLIENT_HOST=192.168.1.41
PUSHER_CLIENT_PORT=6003
```

Se ejecuto primero `-WhatIf` y luego:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Projects\S_Hospital\scripts\refresh_lan_ip.ps1 -ServerIp 192.168.1.10 -AppPort 8081 -EnvFile C:\tmp\s_hospital_offlinetest.env -ComposeProjectName shospital_offlinetest
```

Despues:

```text
APP_URL=http://192.168.1.10:8081
SERVER_IP=192.168.1.10
APP_PORT=8081
SANCTUM_STATEFUL_DOMAINS=192.168.1.10,192.168.1.10:8081
CORS_ALLOWED_ORIGINS=http://192.168.1.10:8081,https://192.168.1.10:8081
SOKETI_PORT=6003
PUSHER_CLIENT_HOST=192.168.1.10
PUSHER_CLIENT_PORT=6003
```

Verificacion dentro del backend:

```text
http://192.168.1.10:8081|192.168.1.10|192.168.1.10|http://192.168.1.10:8081
```

## Rebuild ejecutado

Publicacion frontend confirmada:

- `docker-compose.prod.yml` construye `backend/Dockerfile.prod`.
- El build de frontend se ejecuta dentro de la imagen.
- El contenedor backend copia `/var/www/frontend/dist/.` a `/shared_public/`.
- Nginx sirve el volumen `shared_public` desde `/var/www/html/public`.

Comandos ejecutados:

```powershell
cd C:\Projects\S_Hospital\frontend
npm ci
npm run typecheck
npm run lint
npm run test
npm run build

docker compose --env-file C:\tmp\s_hospital_offlinetest.env -p shospital_offlinetest -f C:\Projects\S_Hospital\docker-compose.prod.yml build backend queue-worker scheduler
docker compose --env-file C:\tmp\s_hospital_offlinetest.env -p shospital_offlinetest -f C:\Projects\S_Hospital\docker-compose.prod.yml up -d --no-deps backend queue-worker scheduler nginx
```

No se ejecuto `down -v`, no se borraron volumenes y no se tocaron migraciones.

## Assets antes/despues

Antes de rebuild, `8081` servia:

```text
/assets/charts-JUI4aW6N.js
/assets/forms-ditSlwIx.js
/assets/index-BY8sHTvF.css
/assets/index-Cpf-GTF4.js
/assets/page-header-CSTKX416.js
/assets/query-D0qM8L9X.js
/assets/queryKeys-DiUaAaHJ.js
/assets/rolldown-runtime-QTnfLwEv.js
/assets/ui-BhLfDv7l.js
/assets/vendor-Txi_p2nM.js
```

El build local fresco genero:

```text
/assets/index-CBIkWHC-.js
/assets/index-HZ3HlHfx.css
/assets/page-header-CGSZVB-8.js
/assets/queryKeys-DiUaAaHJ.js
/assets/ui-BhLfDv7l.js
```

Despues de rebuild, `8081` sirve:

```text
/assets/charts-JUI4aW6N.js
/assets/forms-ditSlwIx.js
/assets/index-CBIkWHC-.js
/assets/index-HZ3HlHfx.css
/assets/page-header-CGSZVB-8.js
/assets/query-D0qM8L9X.js
/assets/queryKeys-DiUaAaHJ.js
/assets/rolldown-runtime-QTnfLwEv.js
/assets/ui-BhLfDv7l.js
/assets/vendor-Txi_p2nM.js
```

Clasificacion: `BUILD_SYNCED`.

Nota: el volumen `shared_public` conserva algunos assets historicos, pero `index.html` de `8081` referencia el build fresco. No se limpiaron assets antiguos para evitar operaciones innecesarias sobre volumenes.

## 8080

`8080` sigue sirviendo:

```text
TITLE=Caja hospitalaria
/assets/index-D5Pn6EAE.js
/assets/index-_2KLJ895.css
```

Clasificacion: stack viejo/no recomendado. No se detuvo.

## Cache y service worker

Indicacion operativa:

1. Usar solo `http://192.168.1.10:8081`.
2. Cerrar pestanas antiguas de `8080`.
3. Abrir `8081`.
4. Presionar `Ctrl+F5`.
5. Si sigue igual, usar ventana incognito o DevTools > Network > Disable cache y recargar.

Verificacion:

```powershell
git grep -n "serviceWorker\|registerSW\|workbox" -- frontend/src frontend/public
```

Resultado: sin coincidencias.

## Capturas post-rebuild

Carpeta:

```text
qa/runtime-visual-audit/post-rebuild-8081-20260625-2340/
```

Incluye evidencia de:

- login
- dashboard
- nueva factura
- reportes
- receipt settings
- users/admin
- mobile billing
- mobile reports

El archivo `rc-e2e-mocked-report.json` lista 34 capturas.

## Tests y validaciones

Pasaron:

- `npm ci`
- `npm run typecheck`
- `npm run lint`
- `npm run test` (`82` archivos, `487` tests)
- `npm run build`
- `scripts/qa/check-lan-url.ps1` contra `http://192.168.1.10:8081`

Playwright:

```powershell
npx playwright test e2e/production-readiness.spec.ts
```

Resultado: `3 passed`, `1 failed`.

Falla registrada:

- Spec: `main screens expose named controls and dangerous actions can be cancelled`
- Motivo: errores de consola por respuestas `429 Too Many Requests` al endpoint de reportes CSP.
- Pantallas y capturas principales fueron generadas; el reporte JSON no contiene `console_issues`.
- Clasificacion: hallazgo QA no bloqueante para sincronizacion runtime/build. No se modifico codigo productivo para suprimirlo.

## Resultado visual

El runtime ahora corresponde al build fresco de `main` y `8081` esta sincronizado. Si el usuario aun percibe que "se ve igual", la causa probable es que los cambios V1.1 son sobrios o queda cache del navegador.

Siguiente fase visual recomendada solo con autorizacion:

```text
codex/v1-2-visible-ui-delta
```

Alcance sugerido:

- Dashboard
- Nueva factura
- Reportes

Plan preparado:

```text
docs/ux/VISIBLE_UI_DELTA_PLAN.md
```

## Decisiones de seguridad

- No se modifico codigo productivo.
- No se apagaron stacks antiguos.
- No se borraron worktrees.
- No se destruyeron volumenes.
- No se cambio base de datos productiva mediante migraciones ni comandos destructivos.
- Produccion fisica aprobada: NO.
- Tag creado: NO.

## Resultado final

- Runtime corresponde a `main`: SI.
- Build servido actualizado: SI.
- IP LAN alineada: SI.
- `8080` viejo: SI.
- `8081` listo: SI.
- Requiere `VISIBLE_UI_DELTA`: solo si el usuario confirma que, aun con hard refresh en `8081`, el cambio visual sigue siendo insuficiente.
