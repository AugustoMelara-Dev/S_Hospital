---
name: s-hospital-ops-hardening
description: Use this skill when hardening S_Hospital installation scripts, startup automation, local LAN deployment, Docker/MariaDB persistence, automatic backups, restore tests, and non-technical operator documentation.
---

# S_Hospital Operations Hardening Skill

Goal:
Make installation, startup, backups and recovery safe for a public hospital environment.

Rules:
- Remove all "Billing OS" branding from installer, UI and docs visible to users.
- Use neutral institutional wording: "Sistema de Caja Hospitalaria" or "Sistema de Facturacion Hospitalaria".
- Do not delete database volumes or reset production data.
- Before migrations or risky changes, create a backup.
- Backups must be automatic, non-blocking, timestamped, verifiable and restorable.
- UI for backups must be non-technical for normal users.
- Technical logs may exist but behind admin/developer detail.
- Add Windows startup automation using a safe script/task, but do not assume admin passwords.
- Create a desktop shortcut or launcher to reopen the system.
- Document installation and recovery for non-technical staff.

Required audit output:
1. Startup method implemented.
2. Backup schedule and retention.
3. Restore test result.
4. Operator docs created.
5. Safety notes for production.
