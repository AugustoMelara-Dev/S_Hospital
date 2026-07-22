# S_Hospital Release Convergence Design

**Status:** Approved for rapid inline implementation on 2026-07-22.

## Purpose

Turn the existing S_Hospital Laravel + React application into a release-ready,
single-hospital LAN system. The work preserves its billing, cash, fiscal,
permission and audit rules while removing technical language, avoidable delay,
visual noise and divergent document renderers.

This is not a multitenant product, a marketplace or a cloud service. Runtime
operation must remain possible without internet access.

## Product principles

- Cashiers see short task language: what happened, what they can do next and
  where to ask for help. HTTP verbs, paths, stack details and infrastructure
  terminology never appear in operational UI.
- Administrators receive useful operational status without raw implementation
  details. Technical diagnostics remain in logs and authenticated support
  exports.
- The visual system is neutral and restrained: white and cool neutral surfaces,
  dark text, one institutional teal accent for interaction, and semantic color
  only for status.
- Tables, filters and actions share one alignment and density contract.
- Every printed artifact is predominantly black and white. Color is not needed
  to understand totals, statuses or hierarchy.
- Existing shadcn/Radix, TanStack Query/Table, React Hook Form, Zod, Recharts,
  Laravel, Sanctum, DomPDF and PhpSpreadsheet remain the foundation. No library
  is added unless it removes more complexity than it introduces.

## Architecture

### Human-safe error boundary

`userSafeErrorMessage` becomes the single presentation boundary for API errors.
It maps timeout, connectivity, validation, permission and conflict failures to
plain Spanish. Raw request methods, URLs, SQL details, exception names and
internal paths remain available only to logging. Route states and feature views
must consume this boundary rather than displaying `error.message` directly.

### Fast billing catalogue

The billing screen loads the first page immediately after categories and cash
state are known. Selecting `Todas` requests all billable categories and renders
at least ten services when ten exist. The first page remains bounded at 24.
Typing is debounced, previous searches are aborted, cached queries are reused
and stale responses cannot replace newer results.

Backend search keeps filtering in MySQL/MariaDB. Normalized searchable columns
and selective SQL candidate matching avoid loading candidate collections merely
to rank them in PHP. Exact name/code matches rank first, followed by prefix and
contains matches. Required indexes are added through an idempotent migration.

### Invoice history and shared data surfaces

The history toolbar owns search, advanced filters and optional column controls
in one aligned row. The column chooser uses an icon, descriptive accessible
name and compact placement at the right edge; it never appears as a detached
row. Row actions use the same trailing action column pattern as Catalogue and
Users. Mobile uses concise cards without horizontal page overflow.

### One receipt renderer

One normalized receipt view model feeds all receipt surfaces:

- settings preview uses clearly labelled sample data;
- paid invoice modal uses the issued invoice and receipt snapshot;
- history reprint uses the immutable historical snapshot;
- PDF and print use the same hierarchy and field order.

The document is black and white with a compact institutional header, receipt
number, fiscal facts, patient and cashier facts, service table, totals, amount
in words, signatures/seal and footer. Internal codes, QR and barcodes remain
excluded. Paper adapters alter dimensions and spacing only, not content or
visual identity.

### Professional reports and exports

Reports expose three clear destinations: `Resumen`, `Caja` and `Auditoría`.
The primary report flow is period selection, Apply and one Export menu. PDF is
an executive printable report; Excel is a clean workbook for analysis. Both use
the same totals, filters and labels as the screen. Charts use neutral grays plus
one teal series; semantic warnings are textual and do not rely on color.

### Reliable backups and restore

Backup creation moves through queued, running, completed or failed states with
plain-language UI. The server records a protected file only after dump,
encryption and integrity checks succeed. Download verifies authorization and
file existence. Restore remains an administrator/support operation with a dry
run, checksum verification, disposable-database restore test and explicit final
confirmation. The release gate exercises create, process, download, decrypt,
restore and compare using disposable data.

## Copy rules

- Remove `Identidad provisional` from ordinary screens. Configuration may say
  `Complete el nombre y logotipo del hospital` when branding is incomplete.
- Replace technical login marketing with direct reassurance: `Acceso seguro`
  and `Disponible en la red del hospital`.
- Never show `GET`, `POST`, `/api/`, timeout durations, SQL, exception names,
  queue names, filesystem paths or configuration keys to operational users.
- Use singular/plural natural Spanish; avoid parenthetical counters such as
  `1 respaldo(s)`.
- Error states state the failed task and next action in at most two sentences.

## Performance budgets

- Warm authenticated list endpoints: p95 below 750 ms with representative
  synthetic data on the Docker/MariaDB LAN profile.
- Billing search response: p95 below 500 ms for 10,000 services.
- Interaction feedback appears within 100 ms; searches do not block typing.
- No route waits more than 10 seconds without changing to a human recovery
  state, and that state never exposes request internals.

## Accessibility and responsive behavior

- WCAG 2.2 AA contrast, focus visibility, labels, keyboard operation and
  logical heading order apply to every changed surface.
- Controls have at least a 44 by 44 CSS pixel target on touch layouts.
- Desktop is validated at 1366x768 and 1440x900; mobile at 390x844 and 320x568;
  zoom at 200 percent must not introduce two-dimensional page scrolling.
- Printed documents remain legible in grayscale and at their declared paper
  size.

## Delivery phases

1. P0 safety and speed: human-safe errors, invoice timeout root cause, billing
   catalogue initial load/search and backup queue health.
2. P1 visual convergence: login/identity, shared table toolbars and history.
3. P1 document convergence: one receipt model/renderer and black-and-white PDF.
4. P1 reporting: simplified screen and professional PDF/Excel exports.
5. Release certification: CRUD, RBAC, invoice/payment/receipt, reports,
   backup/restore, accessibility, load, migration and rollback evidence.

Each phase is test-first and committed independently using Conventional Commits.

## Acceptance criteria

- Selecting `Todas` in New Invoice displays at least ten billable services when
  the database contains ten, without requiring text input.
- Search remains responsive and returns exact/prefix matches before contains
  matches under representative load.
- No rendered role surface contains raw HTTP methods, API paths or internal
  diagnostics.
- The settings sample, issued receipt, history preview and PDF share structure,
  typography and monochrome styling; only their data source differs.
- History controls align with the table and column configuration is compact.
- Report creation takes one obvious path and PDF/Excel totals match the API.
- Backup creation, processing, download and disposable restore verification
  pass with encrypted artifacts.
- Relevant Laravel, React and Playwright suites pass; migration and rollback
  are proven from a clean disposable database; no reproducible P0/P1 remains.

## Out of scope

- Multitenancy, marketplace, public AI, subscriptions, PostgreSQL migration,
  public cloud deployment, advertising and real-hospital pilot recruitment.
- Removing legally or operationally required audit history.
- Replacing the existing application stack without evidence that a component
  cannot meet these contracts.
