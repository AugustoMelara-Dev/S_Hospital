# Offline release regeneration evidence - 2026-06-04

## Scope

Regenerar `offline-release` desde el commit actual despues de integrar el guard
de restore Windows seguro, usando el builder con staging verificado.

## Command

```powershell
# Set a non-secret temporary placeholder in the process environment only.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\make_offline_release.ps1 -Force
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\assert_offline_release_clean.ps1 -RequireCurrentCommit
```

## Result

```text
OFFLINE_RELEASE_CLEAN: YES
MANIFEST.txt references current commit adb0014a
offline-images contains 4 Docker image tar file(s)
```

## Included images

- `backend.tar`
- `queue-worker.tar`
- `nginx.tar`
- `mariadb.tar`

## Safety notes

El `HOSPITAL_LICENSE_SALT` usado fue un placeholder temporal para permitir la
interpolacion de Docker Compose durante el build local. No se escribio a `.env`,
no se commiteo y no debe usarse en produccion. El builder publico el paquete
solo despues de pasar `assert_offline_release_clean.ps1` sobre staging.
