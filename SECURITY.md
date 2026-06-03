# Security policy

The S_Hospital system runs on a hospital LAN. There is no cloud, no
SaaS, and no third-party identity provider, so "vulnerability
response" is a local exercise. This document defines how to report
an issue, what we will support, and how we backport fixes.

## Reporting a vulnerability

Please email **security@hospital-san-isidro.local** with:

- A short description of the issue
- The component affected (backend, frontend, deploy script, nginx,
  mariadb, soketi, scheduler, queue-worker)
- Steps to reproduce, including any local-only URLs
- Whether patient data or credentials are at risk

We treat every report as confidential. Do not file a public issue
until we confirm a fix or 30 days have passed, whichever comes first.

## Supported versions

Only **v1.0.0 and later** are supported. Earlier RCs and any
internal pre-release branches are not eligible for security
backports; if you are still on an RC, upgrade to v1.0.0 first.

## Backport policy

Critical fixes (CVSS >= 7.0, or anything that exposes patient data
or allows privilege escalation) are backported to the latest
release-candidate branch for **90 days** after the GA tag. After
that window the fix lives only on `main` and you must upgrade to
the next minor release to receive it.

Non-critical fixes ship on the normal release cadence described in
`RELEASE_NOTES_v1.0.0.md`.

## Secret management

All secret handling, rotation, and recovery procedures live in
[`docs/SECRETS.md`](docs/SECRETS.md). Read that document before
opening a ticket about keys, tokens, or `.env` files; it is the
source of truth for the install scripts, the pre-commit guard, and
the production readiness preflight.
