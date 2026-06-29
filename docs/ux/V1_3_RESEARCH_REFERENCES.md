# V1.3 Research References

Status: refreshed for `codex/v1-3-total-product-refactor`.
Local review date: 2026-06-28.

Scope: official and primary references used for S_Hospital V1.3 offline/LAN billing, cashbox, reporting, tables, receipts, accessibility, and security decisions.

## Library And Framework Sources

| Topic | Source | V1.3 Use |
| --- | --- | --- |
| shadcn/ui blocks | https://ui.shadcn.com/blocks | Reference for dashboard, sidebar, form, and data-dense composition patterns. Copy patterns only as local code, never as a runtime dependency. |
| shadcn/ui data table | https://ui.shadcn.com/docs/components/data-table | Pattern reference for TanStack Table-backed entity tables. |
| shadcn/ui charts | https://ui.shadcn.com/docs/components/chart | Keep current Recharts usage visually consistent without adding another chart suite. |
| Tailwind v4 theme tokens | https://tailwindcss.com/docs/theme | Keep design tokens in CSS variables and `@theme`; avoid scattered one-off colors. |
| Tailwind dark mode | https://tailwindcss.com/docs/dark-mode | Validate class/selector dark strategy and print isolation. |
| Radix UI accessibility | https://www.radix-ui.com/primitives/docs/overview/accessibility | Default primitive layer for dialogs, menus, popovers, select, tabs, tooltips, and focus behavior. |
| TanStack Table React | https://tanstack.com/table/latest/docs/framework/react/overview | Adopt through the local `DataTable` wrapper for catalog, reports, history, users, and backups where table behavior is shared. |
| TanStack Table pagination | https://tanstack.com/table/latest/docs/guide/pagination | Reference for deciding client vs server pagination in reports/history endpoints. |
| TanStack Virtual React | https://tanstack.com/virtual/latest/docs/framework/react/react-virtual | Defer until measured row counts justify virtualization. |
| Recharts ResponsiveContainer | https://recharts.github.io/en-US/api/ResponsiveContainer | Current chart library; use responsive containers and avoid a second chart stack. |
| cmdk | https://cmdk.paco.me/ | Candidate only for global command/search if cashier navigation evidence justifies it. |
| React Aria Components | https://react-spectrum.adobe.com/react-aria/ | Candidate only when Radix does not cover a complex accessible interaction. |
| Ariakit | https://ariakit.org/ | Candidate only as a specific fallback; do not mix primitive systems casually. |
| Zod | https://zod.dev/ | Keep frontend form schemas aligned with API contracts without becoming the fiscal source of truth. |
| date-fns | https://date-fns.org/ | Candidate only if report date/range utilities keep duplicating or drifting. |

## Accessibility And UX Sources

| Topic | Source | V1.3 Use |
| --- | --- | --- |
| WCAG 2.2 Quick Reference | https://www.w3.org/WAI/WCAG22/quickref/ | Acceptance reference for focus visibility, contrast, target size, names/roles/values, and error identification. |
| WAI-ARIA APG | https://www.w3.org/WAI/ARIA/apg/ | Keyboard and ARIA interaction reference for dialogs, tabs, menus, comboboxes, and grids. |
| GOV.UK form validation | https://design-system.service.gov.uk/patterns/validation/ | Plain, actionable validation messages for cashier/admin forms. |
| GOV.UK error messages | https://design-system.service.gov.uk/components/error-message/ | Error placement and text principles for form fields. |
| Nielsen Norman Group dashboards | https://www.nngroup.com/articles/dashboard-design/ | Primary UX reference for dashboards that summarize status and support decisions instead of decorating data. |

## Security And Operational Sources

| Topic | Source | V1.3 Use |
| --- | --- | --- |
| OWASP Access Control Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html | RBAC/IDOR review for users, receipts, invoices, reports, backups, and voiding. |
| OWASP CSRF Prevention Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html | Session write protection review for LAN browser clients. |
| OWASP Session Management Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html | Login/session hardening review. |

## Product Principles Derived For V1.3

- Cashier workflows must be keyboard-friendly, fast to scan, and resilient to interrupted work.
- Backend remains the source of truth for fiscal totals, payment state, receipt issuance, permissions, and audit.
- Tables should be consistent across catalog, reports, users, backups, and invoice history: filters, sort, pagination, stable actions, loading, empty, and error states.
- Use TanStack Table through local wrappers before creating one-off tables.
- Defer TanStack Virtual until performance evidence shows row rendering pressure.
- Do not add `cmdk`, React Aria, Ariakit, or date-fns without a concrete flow that Radix/local helpers cannot handle safely.
- Receipt/PDF UX must privilege institutional paper output; thermal formats are secondary compatibility.
- Offline/LAN status must be factual and local; no cloud dependency should appear in daily workflows.
