# Changelog - Sistema de Caja Hospitalaria

## v1.0.0-rc.1 - Phase 12 Final (2026-05-18)

### What's New

**POS Billing Workflow**
- 2-column layout: search/services left (internal scroll), sticky cart right
- Service cards with rich hover states and visible price badges
- Cart with item count badge and always-visible totals
- InvoiceSuccess with clear next actions (Cobrar ahora, Imprimir, Ver facturas)
- Cash session consistency across Dashboard, Sidebar, Topbar, and POS

**Components Migrated to shadcn/Radix**
- ReceiptPreview: NativeSelect replaced with Select component
- IncomeReportTab: 3 NativeSelect filters replaced with Select components

**Reports & Backups Hierarchy**
- ReportsView: clean shadcn/ui Tabs with KPIs at top
- BackupsView: summary cards (pending/success/failed) + filterable table
- FiscalSettingsView: organized into 4 tabs (Resumen/Hospital/Secuencia/Receipt)

### Quality Gates

| Gate | Status |
|------|--------|
| TypeScript | ✅ 0 errors |
| ESLint | ✅ 0 errors |
| Build | ✅ Passes (638KB gzip: 187KB) |
| Frontend Tests | ✅ 20/20 (3 consecutive runs) |
| Backend Tests | ✅ 124/124 |
| E2E | ✅ 2/2 |
| Laravel Pint | ✅ Passes |

### Commits

- `56c9564` - fix(ux): polish POS workflow and product layout
- `4724dc6` - fix(styles): deduplicate @media print blocks in CSS
- `93f034e` - fix(qa): resolve security, UX, and E2E issues
- `6897f84` - refactor(hospital): comprehensive visual and UX overhaul

### Known Limitations

- Print hardware validation (80mm/58mm) pending physical testing
- LAN client validation pending from another PC
- Production environment validation pending final server setup

---

## Previous Releases

See `docs/07_FINAL_PHASES_ROADMAP.md` for phase history.