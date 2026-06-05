# Offline release regeneration evidence - 2026-06-04

## Scope

Regenerar `offline-release` desde el commit `2c0657f9` despues de integrar la
preservacion de evidencia de regeneracion offline, usando un worktree limpio y
el builder con staging verificado.

## Command

```powershell
# Set a non-secret temporary placeholder in the process environment only.
powershell -NoProfile -ExecutionPolicy Bypass -File %CLEAN_WORKTREE%\scripts\make_offline_release.ps1 -ProjectRoot %CLEAN_WORKTREE% -ReleaseRoot %PROJECT_ROOT%\offline-release -Force
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\assert_offline_release_clean.ps1 -ProjectRoot %CLEAN_WORKTREE% -ReleaseRoot %PROJECT_ROOT%\offline-release -RequireCurrentCommit
```

## Result

```text
OFFLINE_RELEASE_CLEAN: YES
MANIFEST.txt references current commit 2c0657f9
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
no se commiteo y no debe usarse en produccion. El build se ejecuto desde un
worktree limpio para no incluir cambios locales no relacionados. El builder
publico el paquete solo despues de pasar `assert_offline_release_clean.ps1`
sobre staging.
