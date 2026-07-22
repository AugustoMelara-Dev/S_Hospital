# Revisión de Accesibilidad WCAG 2.2 AA - 05 Accessibility Review

- **Sistema**: S_Hospital
- **Fecha**: 2026-07-22

## Evaluación de Criterios WCAG 2.2 AA

| Criterio | Descripción | Estado | Observación / Ajuste Realizado |
| --- | --- | --- | --- |
| 2.1.1 Keyboard | Navegación completa solo con teclado | Conforme | Todos los botones e inputs capturan y liberan foco correctamente. |
| 2.4.7 Focus Visible | Indicador visual de foco | Conforme | Anillo `focus-visible:ring-2` en controles shadcn/ui. |
| 1.4.3 Contrast (Minimum) | Contraste de texto >= 4.5:1 | Conforme | Colores neutros de alto contraste en modo claro/oscuro. |
| 4.1.2 Name, Role, Value | Semántica ARIA y nombres accesibles | Conforme | Diálogos con `SheetTitle`/`DialogTitle` y botones con `aria-label`. |
| 1.4.10 Reflow | Adaptación sin scroll horizontal a 400% zoom | Conforme | Layout responsivo sin desbordamiento de página. |
