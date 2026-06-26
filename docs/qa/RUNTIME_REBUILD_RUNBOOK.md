# Runtime Rebuild Runbook

Objetivo: reconstruir/reiniciar el stack correcto para que los clientes LAN vean el build esperado, sin borrar datos ni volumenes.

## Stack detectado

| Stack | URL | Uso recomendado |
| --- | --- | --- |
| `shospital_offlinetest` | `http://192.168.1.10:8081` | Candidato principal auditado |
| `shospital_prodtest` | `http://192.168.1.10:8080` | Stack anterior; no usar para validacion visual V1.1 |
| `s_hospital_f7_verify` | `http://localhost:18080` | Verificacion antigua |

## Hallazgos antes de rebuild

- `8081` sirve UI V1.1 visualmente, pero no sirve el asset fresco `index-CBIkWHC-.js`.
- `8080` sirve build anterior y branding antiguo.
- `shospital_offlinetest` tiene env desalineado: `APP_URL`, `SERVER_IP`, CORS y Sanctum apuntan a `192.168.1.41`, mientras la URL auditada es `192.168.1.10:8081`.

## Precondiciones

1. Confirmar que el entorno no es produccion fisica operativa o recibir autorizacion explicita.
2. Confirmar URL objetivo: `http://192.168.1.10:8081`.
3. Confirmar que no hay usuarios cobrando o imprimiendo.
4. Crear backup antes de tocar contenedores.

## Backup previo

Ejemplo seguro para stack Docker:

```powershell
docker compose --env-file C:\tmp\s_hospital_offlinetest.env -p shospital_offlinetest -f C:\Projects\S_Hospital\docker-compose.prod.yml exec backend php artisan hospital:backup --manual
```

Si el comando no existe o falla, no continuar con rebuild hasta registrar el motivo y decidir con el operador.

## Alinear IP LAN

Usar el script existente con `-WhatIf` primero:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Projects\S_Hospital\scripts\refresh_lan_ip.ps1 -ServerIp 192.168.1.10 -AppPort 8081 -EnvFile C:\tmp\s_hospital_offlinetest.env -ComposeProjectName shospital_offlinetest -WhatIf
```

Si la salida es correcta y hay autorizacion:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Projects\S_Hospital\scripts\refresh_lan_ip.ps1 -ServerIp 192.168.1.10 -AppPort 8081 -EnvFile C:\tmp\s_hospital_offlinetest.env -ComposeProjectName shospital_offlinetest
```

## Rebuild/restart sin destruir datos

No usar `down -v`.

```powershell
docker compose --env-file C:\tmp\s_hospital_offlinetest.env -p shospital_offlinetest -f C:\Projects\S_Hospital\docker-compose.prod.yml build backend queue-worker scheduler
docker compose --env-file C:\tmp\s_hospital_offlinetest.env -p shospital_offlinetest -f C:\Projects\S_Hospital\docker-compose.prod.yml up -d --no-deps backend queue-worker scheduler nginx
```

Si el frontend se publica desde `shared_public`, validar que el backend copio `frontend/dist` al volumen compartido durante build/start. Si no, usar el procedimiento de release del proyecto y no copiar archivos manualmente a ciegas.

## Validacion post-rebuild

```powershell
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}"
powershell -ExecutionPolicy Bypass -File C:\Projects\S_Hospital\scripts\qa\check-lan-url.ps1 -Url "http://192.168.1.10:8081"
```

Comprobar assets:

```powershell
$r = Invoke-WebRequest -Uri "http://192.168.1.10:8081" -UseBasicParsing
$r.Content | Select-String "/assets/"
```

Comprobar que la app ya no referencia bundles antiguos esperados para `8080`.

## Limpiar cache del navegador

1. Abrir `http://192.168.1.10:8081`.
2. Presionar `Ctrl+F5`.
3. Si sigue igual, cerrar todas las pestañas de la app y abrir una ventana nueva.
4. Si se uso Chrome DevTools: Network > Disable cache mientras DevTools esta abierto, recargar.

No se detecto service worker en el frontend, por lo que no hay que unregister SW.

## Validacion visual

Capturar despues del rebuild:

```powershell
cd C:\Projects\S_Hospital\frontend
$env:PLAYWRIGHT_EXTERNAL_SERVER='1'
$env:PLAYWRIGHT_BASE_URL='http://192.168.1.10:8081'
$env:E2E_CAPTURE_RC_SCREENSHOTS='1'
$env:E2E_CAPTURE_RC_OUTPUT_DIR='../qa/runtime-visual-audit/post-rebuild-8081'
$env:E2E_CAPTURE_RC_REPORT_DIR='qa/runtime-visual-audit/post-rebuild-8081'
npx playwright test e2e/production-readiness.spec.ts
```

## Rollback operativo

Si el rebuild falla:

1. No borrar volumenes.
2. Guardar logs:

```powershell
docker compose --env-file C:\tmp\s_hospital_offlinetest.env -p shospital_offlinetest -f C:\Projects\S_Hospital\docker-compose.prod.yml logs --tail 200 > C:\Projects\S_Hospital\qa\runtime-visual-audit\rebuild-failure.log
```

3. Restaurar solo desde backup verificado si hubo perdida de datos, no por fallas de UI.

## Estado

Este runbook fue preparado, pero no ejecutado en esta auditoria. No se reinicio ningun stack.
