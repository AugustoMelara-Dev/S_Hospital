# Installer legacy safety evidence - 2026-06-03

Decision: `PASS`.

Scope:

- Verify that the supported production installer remains `scripts\deploy_hospital_lan.ps1`.
- Verify that root `setup.bat` delegates to the supported LAN installer.
- Verify that root `setup.bat` runs from its own folder, disables PowerShell
  profiles and keeps institutional production wording.
- Verify that the offline release guard checks root `setup.bat` against the
  versioned launcher source before handoff.
- Verify that `scripts\install_hospital_os.ps1` stays marked as deprecated compatibility only.
- Verify that active operator docs do not point staff to the legacy installer as the normal path.

Command run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate_installer_legacy_safety.ps1
```

Observed result:

- `INSTALLER_LEGACY_SAFETY: YES`.
- `scripts\release_setup.bat` delegates to `scripts\deploy_hospital_lan.ps1`.
- `scripts\release_setup.bat` switches to its own directory before launching,
  calls PowerShell with `-NoProfile`, gives administrator recovery instructions
  and does not use legacy/demo wording.
- `scripts\make_offline_release.ps1` copies `scripts\release_setup.bat` as root `setup.bat`.
- `scripts\assert_offline_release_clean.ps1` checks root `setup.bat` against
  `scripts\release_setup.bat` and rejects legacy/demo launchers.
- `scripts\install_hospital_os.ps1` keeps a runtime `DEPRECATION NOTICE` and points operators to the supported installer.
- Installation docs tell operators to use `setup.bat` and clarify that old shortcuts to `install_hospital_os.ps1` are compatibility only.

Safety notes:

- This check is read-only.
- It does not start Docker, register tasks, modify `.env`, migrate data or open firewall rules.
- The current local `offline-release` remains stale and must be regenerated before handoff.
