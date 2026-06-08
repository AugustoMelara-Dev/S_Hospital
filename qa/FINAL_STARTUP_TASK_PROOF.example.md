# Final startup task proof template

Copy this file to `qa/FINAL_STARTUP_TASK_PROOF.md` only on the final server
after installing or updating the stack autostart task and observing that the
system comes back after startup without a developer present.

Do not attach `.env`, passwords, task XML exports, screenshots with secrets,
SQL dumps or absolute local paths. Evidence must be a safe relative file under
`qa/` or a physical support reference.
Keep evidence anonymous. Use role, position or initials in `Responsible person`;
do not write full staff names, patient names, usernames, passwords, `.env`
values or local paths.

## Required fields

- Date/time:
- Responsible person:
- Server computer name:
- Startup task status:
- Startup task trigger:
- Startup command check:
- Startup or reboot test time:
- Server URL after startup:
- Evidence/capture reference:
- Final conclusion:

## Required checks

- [ ] `SistemaCajaHospitalaria-StackAutostart` installed and Ready/Running. Result/evidence:
- [ ] Task trigger is `AtStartup`. Result/evidence:
- [ ] Task action points to the supported hospital startup script, not a destructive or demo command. Result/evidence:
- [ ] Server startup or a supervised manual task start was observed after services were stopped or the server rebooted. Result/evidence:
- [ ] `/up` is reachable after startup from the server browser. Result/evidence:
- [ ] Login page is reachable after startup without internet. Result/evidence:
- [ ] Evidence does not include `.env`, passwords, task XML exports, SQL dumps or absolute local paths. Result/evidence:

## Final conclusion

Do not mark `PRODUCTION_READY` unless every check above is completed with real
final-server evidence and the handoff/preflight pass without bypass flags.
