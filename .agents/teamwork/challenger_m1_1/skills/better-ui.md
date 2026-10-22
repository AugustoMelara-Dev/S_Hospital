# better-ui skill copy
Source: c:\Projects\S_Hospital_AI\.agents\skills\better-ui\SKILL.md

Core rules:
- Concentric border radius: Outer radius = inner radius + padding.
- Optical alignment: Buttons with icons, asymmetric icons need manual nudge.
- Shadows for elevation, borders for structure.
- Interruptible animations: CSS transitions for interactive state changes.
- Split and stagger enter animations: ~100ms stagger for infrequent staged entrances.
- Subtle exit animations: Small fixed translateY, ease-out.
- Scale on press: scale(0.96) on click for tactile feedback.
- Suppress transitions on theme switch.
- Transition only what changes (no transition: all).
- Icon stroke matches text weight. One SVG recolored per state.
