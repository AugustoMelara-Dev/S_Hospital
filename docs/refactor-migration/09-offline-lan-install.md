# Instalación offline y LAN

## Artefacto

Ejecutar en la máquina de preparación con red:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/make_offline_release.ps1
```

El resultado local `offline-release/` contiene seis imágenes Docker (backend, queue worker, scheduler, Nginx, MariaDB y Soketi), `MANIFEST.txt`, checksums SHA-256, compose, instalador y documentación operativa. El artefacto generado el 2026-07-21 pesa 401,02 MB en imágenes y pasó `assert_offline_release_clean.ps1` con `OFFLINE_RELEASE_CLEAN: YES`.

El stack de producción aislado fue reiniciado después del E2E: la API volvió con HTTP 200, los servicios alcanzaron sus healthchecks y la factura de certificación siguió persistida en MariaDB.

En el servidor Windows destino se copia la carpeta completa y se ejecuta `setup.bat`; la opción Docker carga las imágenes locales, crea `.env` sin reutilizar secretos del repositorio, inicia servicios, migra, crea el administrador inicial, espera healthchecks y muestra la URL LAN.

## Verificación reproducible

- `scripts/offline_release_contract.test.ps1`: PASS.
- `scripts/production_readiness_preflight.test.ps1`: PASS.
- `scripts/test_installer_diagnostics.ps1`: 16/16 PASS.
- `scripts/lan_asset_discovery.test.ps1`: PASS.
- `scripts/docker_compose_dev_contract.test.ps1`: PASS.

Los procedimientos de firewall, backup, restore, actualización y rollback están en `docs/OFFLINE_LAN_INSTALL.md`, `docs/BACKUP_RESTORE.md` y `docs/SAFE_UPDATE_ROLLBACK.md`.

La carga totalmente desconectada y el acceso desde un segundo cliente requieren dos máquinas/red física. Deben registrarse con `qa/LOCAL_SERVER_VALIDATION_PROOF.example.md` y `qa/LAN_CLIENT_VALIDATION_PROOF.example.md` durante el cutover.
