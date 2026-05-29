---
name: s-hospital-ux-a11y
description: Use this skill when auditing or refactoring S_Hospital screens, design system, dark mode, accessibility, keyboard navigation, Spanish UX copy, and operator workflows for a public hospital cashier/facturation system.
---

# S_Hospital UX + Accessibility Skill

Goal:
Make S_Hospital feel like a polished institutional system for non-technical hospital staff.

Rules:
- Do not add random inline styles.
- First inspect the existing design system: Tailwind config, CSS variables, theme provider, shared UI components, layout components, buttons, inputs, tables, modals, alerts and cards.
- Improve through shared tokens/components, not one-off screen hacks.
- Maintain Spanish institutional language.
- Default UX must be simple for cashier staff.
- Every action must have loading, disabled, success and error states.
- No duplicated submissions.
- Keyboard-only operation must work.
- Focus states must be visible.
- Dark mode and light mode must both pass contrast.
- Follow WCAG 2.2 AA intent where feasible.
- Do not expose technical details to normal users.
- Keep technical diagnostics only in admin/developer sections.

Required audit output:
1. List screens audited.
2. List UX/accessibility issues found.
3. List files changed.
4. Screenshots before/after if Playwright exists.
5. Tests run.
