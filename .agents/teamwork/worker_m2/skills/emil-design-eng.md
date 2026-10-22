# emil-design-eng (Local Dump)
Source: c:\Projects\S_Hospital_AI\.agents\skills\emil-design-eng\SKILL.md
Description: UI polish, component design, animation decisions, and invisible details that make software feel great.

Key Rules:
1. Review format: Before/After/Why table.
2. Fast, crisp UI transitions under 250ms (or no animation on high-frequency keyboard interactions).
3. Scale on press: transform scale(0.97) on button :active.
4. Never scale(0); start from scale(0.95) with opacity 0.
5. Popovers/dialogs: transform-origin aware (modals stay centered).
6. Performance: animate transform and opacity only.
