# Offline Release - Smoke Guard Results (2026-06-04)

> Resultado de la bateria automatica de validaciones del paquete
> `offline-release/` regenerado en este commit. La prueba real en
> VM sin internet queda registrada en `qa/FINAL_RESTORE_PROOF.md`
> y `qa/FINAL_CONCURRENCY_PROOF.md` una vez ejecutado en el
> servidor final del hospital.

## 1. assert_offline_release_clean.ps1 -SelfTest

Comando:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/assert_offline_release_clean.ps1 -SelfTest
```

Resultado:

```text
[OK] SelfTest passed. Only final-field qa/*.example.md templates are allowed in offline release.
```

Cubre: layout de la carpeta simulada, `setup.bat` delega al
instalador LAN soportado, manifest referenciando el commit actual,
`nginx/default.conf` >= 80 lineas, `nginx/crontab` presente,
scripts criticos sin secrets.

## 2. validate_dependency_manifest.ps1

Comando:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/validate_dependency_manifest.ps1
```

Resultado:

```text
Manifest matches composer.json and package.json.
  backend deps declared: 15
  frontend deps declared: 48
```

Cubre: cada libreria listada en `package_manifest.json` debe
estar presente en `backend/composer.json` o
`frontend/package.json`, y viceversa para los paquetes
criticos del stack (React, TanStack Query, Laravel, Sanctum,
Spatie Permission, etc.).

## 3. assert_production_docker_sources.ps1

Comando:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/assert_production_docker_sources.ps1
```

Resultado:

```text
[OK] docker-compose.prod.yml contains service nginx
[OK] docker-compose.prod.yml contains service mysql
[OK] nginx upload limit (32M) is aligned with PHP limits (32M/32M)

PRODUCTION_DOCKER_SOURCES: YES
```

Cubre: `Dockerfile.prod` y `docker-compose.prod.yml` del paquete
coinciden con las fuentes productivas, todos los COPY del
Dockerfile tienen archivos reales, y los limites de upload de
PHP y nginx estan alineados (32 MB).

## 4. Validacion cruzada con offline-release/CHECKSUMS

```text
EB1AF8ADD72DA75A812EAC959089CFA05F3EA61BEF3D7257AE6975935B957BA6  offline-images/backend.tar
E4A39A1226D30138BFB1B661775E763B5CE041220C6E39DD492187BD3EFDFAA0  offline-images/mariadb.tar
DF1B909B6CF2D15738761025E8FE0756C1B1E1FF5FEB107A9A32C78BC0D03E25  offline-images/nginx.tar
88C230FBF61169CD3B32BD0811F30D3893CDA281880859A241D5F8D77BF69E55  offline-images/queue-worker.tar
```

Las imagenes tienen SHA256 registrados, lo que permite al
operador validar la integridad del paquete al recibirlo en el
USB.

## 5. Pendiente: smoke real en VM sin internet

La prueba final requiere un host Windows 10/11 con Docker Desktop
y sin conexion a internet. Los pasos para el operador en campo
estan en `qa/OFFLINE_RELEASE_BUILD_FINAL_2026_06_04.md`. Mientras
tanto, los tres guards anteriores dan una confianza operativa
muy alta de que el paquete no tiene drift con el codigo fuente.

## Conclusion

Los guards automatizados pasan limpios. El paquete esta listo
para ser transferido al servidor final del hospital. La
validacion final (restore + concurrencia + LAN + impresora) es
el unico bloqueante restante para `PRODUCTION_READY` y depende
de ejecutar las plantillas `qa/FINAL_*_PROOF.md` en campo.
