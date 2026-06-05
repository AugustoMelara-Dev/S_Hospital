# Offline release regeneration evidence - 2026-06-04

## Scope

Regenerar `offline-release` desde el commit activo de la fase despues de
integrar la preservacion del guard LAN/loadtest y corregir las fuentes
productivas de Nginx para el guard Docker/offline, usando un worktree limpio y
el builder con staging verificado.

## Command

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\make_offline_release.ps1 -Force -SkipDockerBuild
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\assert_offline_release_clean.ps1 -RequireCurrentCommit
```

## Result

```text
OFFLINE_RELEASE_CLEAN: YES
MANIFEST.txt references current commit
offline-images contains 4 Docker image tar file(s)
```

## Included images

- `backend.tar`
- `queue-worker.tar`
- `nginx.tar`
- `mariadb.tar`

## Safety notes

`-SkipDockerBuild` se uso porque las cuatro imagenes ya existian localmente; el
builder ejecuto `docker save` y recalculo checksums. No se escribio a `.env`, no
se borro ningun volumen, no se restauro ninguna base y no se tocaron servicios
productivos. El builder publico el paquete solo despues de pasar
`assert_offline_release_clean.ps1` sobre staging.
