# emil-design-eng (local copy)
Source: c:\Projects\S_Hospital_AI\.agents\skills\emil-design-eng\SKILL.md

Key concepts:
- Buttons must feel responsive (`scale(0.97)` on active).
- Never animate from scale(0) - start from scale(0.95) with opacity 0.
- Make popovers origin-aware (modals exempt).
- Use CSS transitions over keyframes for interruptibility.
- Animate enter states with @starting-style or data attributes.
- Animation speed < 300ms for UI elements.
- Never animate keyboard-initiated actions.
