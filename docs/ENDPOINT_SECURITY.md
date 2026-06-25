# Endpoint Security Runbook

## Scope

S_Hospital is designed for a local LAN. Endpoint security is an operational
responsibility for the server PC and every browser client PC.

## Required Controls

- Use supported Windows or Linux versions listed in `SYSTEM_REQUIREMENTS.md`.
- Keep antivirus or the hospital-approved endpoint protection enabled.
- Disable USB autorun on the server and cashier PCs.
- Do not install browser extensions on cashier profiles unless approved.
- Do not expose MySQL/MariaDB directly to client PCs.
- Keep `.env`, backup files, database volumes, and logs away from shared
  folders.

## Browser Client Rules

- Access the system by the approved LAN URL only.
- Do not save administrator passwords in public/shared browser profiles.
- Do not use patient-facing or public PCs as cashier stations.
- Lock the OS session when leaving the station.

## Server Rules

- Limit OS administrator access to the responsible technical operator.
- Keep Docker, web server, database, and backup directories writable only by the
  service/operator accounts that require them.
- Store support evidence without secrets and without real patient data unless
  the hospital explicitly authorizes it.

## Status

These controls are external operational gates. They are required for physical
go-live but are not missing software features.
