# V1.3 Research References

Scope: official library/accessibility references for offline LAN hospital billing UI decisions.

## Official Sources

| Topic | Source | V1.3 Use |
| --- | --- | --- |
| shadcn/ui blocks | https://ui.shadcn.com/blocks | Reference for dashboard/sidebar/form composition; copy patterns only when they fit hospital operations. |
| shadcn/ui data table | https://ui.shadcn.com/docs/components/data-table | Candidate table pattern built on TanStack Table. |
| shadcn/ui chart | https://ui.shadcn.com/docs/components/chart | Keep Recharts-based chart conventions consistent. |
| Tailwind v4 theme tokens | https://tailwindcss.com/docs/theme | Use `@theme` and CSS variables as the design-system token source. |
| Tailwind dark mode | https://tailwindcss.com/docs/dark-mode | Validate class/selector dark strategy and avoid print regressions. |
| Radix accessibility | https://www.radix-ui.com/primitives/docs/overview/accessibility | Default primitives for dialogs, menus, popovers, tabs, select, tooltip. |
| TanStack Table React | https://tanstack.com/table/latest/docs/framework/react/overview | Candidate for professional report/history/admin tables. |
| TanStack Table pagination | https://tanstack.com/table/latest/docs/guide/pagination | Reference for server/client pagination choices. |
| TanStack Virtual React | https://tanstack.com/virtual/latest/docs/framework/react/react-virtual | Evaluate only for evidence of large table rendering pressure. |
| Recharts ResponsiveContainer | https://recharts.github.io/en-US/api/ResponsiveContainer | Keep charts responsive without introducing a second chart suite. |
| WAI-ARIA APG | https://www.w3.org/WAI/ARIA/apg/ | Keyboard interaction and ARIA patterns for dialogs, grids, tabs, menus. |
| WCAG 2.2 Quick Reference | https://www.w3.org/WAI/WCAG22/quickref/ | Acceptance reference for focus, contrast, target size, names/roles/values. |
| cmdk | https://cmdk.paco.me/ | Evaluate command palette/global search only if it improves cashier navigation. |
| React Aria Components | https://react-spectrum.adobe.com/react-aria/ | Evaluate only for complex accessible interactions Radix does not cover. |
| Ariakit | https://ariakit.org/ | Fallback candidate for complex composite widgets; avoid duplication with Radix. |

## Product UX Principles For V1.3

- Cashier flows must be keyboard-first, fast to scan, and forgiving of interruptions.
- Supervisory flows must show audit, permission, and financial state without decorative clutter.
- Tables must support repeated operational work: filters, sort, pagination, visible actions, and stable column widths.
- Receipt and print UX must privilege institutional paper/PDF over thermal compatibility.
- Offline/LAN status should inform operators without creating false cloud dependency.
- Mobile must be usable at 320 and 375 px, not merely non-crashing.
