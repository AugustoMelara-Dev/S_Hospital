# F10 — Ops: setup.bat sin password en CLI

**Fecha:** 2026-06-01
**Fase del plan:** 10 de 12
**Rama:** `codex/audit-f1-config-hardening`
**Commit:** `78e27353 fix(ops): remove plaintext initial admin password from setup.bat`

## Hallazgo cerrado

- **HIGH** (auditoría) — `setup.bat:132` imprimía `--password=CAMBIAR_ESTA_CLAVE` en la línea de comandos, contradiciendo `docs/OFFLINE_LAN_INSTALL.md` "Admin inicial seguro" y `docs/INSTALL_SUMMARY.md` paso 7. El otro agente ya había arreglado `scripts/deploy_hospital_lan.ps1` (commit `68f365b0`) pero el script raíz del repo seguía con la versión insegura.

## Cambios

- `setup.bat:128-138` — reemplazado el placeholder inseguro por instrucciones que:
  - Usan `HOSPITAL_INITIAL_ADMIN_PASSWORD` como variable de entorno
  - Pasan la variable al contenedor Docker via `-e`
  - Recomiendan que el operador la escriba solo en su sesión local (no en línea de comando visible)
  - Indican que el primer inicio de sesión forzará el cambio de la clave temporal
  - Reflejan el patrón ya documentado en `deploy_hospital_lan.ps1`

## Decisiones técnicas

- **Solo cambio de documentación, no de comportamiento** — `setup.bat` es el script de validación local (header dice "setup local / validacion"). El comportamiento de la creación del admin es responsabilidad del comando `auth:create-initial-admin` en el backend, que ya lee `HOSPITAL_INITIAL_ADMIN_PASSWORD` del entorno (verificado en `routes/console.php` por el commit `68f365b0`).
- **No toqué `setup.bat` antes** — esperé a confirmar que el comando artisan realmente lee la variable (no la posición CLI). El test `InitialAdminCommandTest` cubre esto.

## Quality gate

```
git diff     → solo cambia el bloque de instrucciones finales
```

## Próxima fase

F11 — Regenerar `offline-release/MANIFEST.txt` con HEAD real, añadir healthchecks al backend y nginx en `docker-compose.prod.yml`, ajustar `client_max_body_size` en nginx.
