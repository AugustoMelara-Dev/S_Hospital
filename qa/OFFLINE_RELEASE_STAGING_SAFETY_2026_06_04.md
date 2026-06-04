# Offline release staging safety evidence - 2026-06-04

Decision: `PASSED`.

Scope:

- Verify that `scripts/make_offline_release.ps1` builds the offline package in a staging directory before publishing.
- Verify that the previous `offline-release` is not deleted before the staged artifact has passed the offline release guard.
- Verify that a failed guard run keeps the previous release directory intact.
- Verify that the final handoff preserves this safety guard.

Commands run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate_offline_release_staging_safety.ps1
```

```powershell
# Disposable workspace fixture with -SkipDockerBuild and -SkipDockerSave.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\make_offline_release.ps1 `
  -ReleaseRoot <workspace-test>\offline-release `
  -Force `
  -AllowDirty `
  -SkipDockerBuild `
  -SkipDockerSave
```

Observed result:

- `OFFLINE_RELEASE_STAGING_SAFETY: YES`.
- The disposable guard run failed as expected because no Docker image tar files were generated.
- `PRESERVE_TEST_EXIT=1`.
- `PRESERVE_TEST_MARKER_EXISTS=True`, proving the previous release directory survived the failed publish attempt.

Safety notes:

- The preservation test used a disposable workspace fixture and cleaned only that generated fixture path.
- The real ignored `offline-release` directory was not regenerated or deleted during this evidence run.
- No database, `.env`, backup, production data or Docker volume was modified.
