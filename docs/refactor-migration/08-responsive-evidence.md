# Evidencia responsive y accesibilidad

## Cobertura

Las rutas y estados críticos cuentan con pruebas de overflow, navegación y evidencia visual en:

- `qa/operational-ux/before/` — línea base inmutable;
- `qa/operational-ux/after/canonical/` — comparación canónica ruta por ruta;
- `qa/operational-ux/after/core/` — facturación en 320×568, 360×800, 390×844, 768×1024, 1024×768, 1366×768 y 1440×900;
- `qa/v1-2-full-ux-ui-redesign/after/` — shell, estados, móvil, escritorio y modo oscuro;
- `qa/operational-ux/after/receipt-matrix/` — perfiles y volúmenes de impresión.

La revisión de 1920×1080 y zoom efectivo 125 %/200 % está registrada en la línea base y los tests de reflow. Los E2E de facturación, historial, reportes, catálogo y recibos comprueban programáticamente ausencia de overflow horizontal a 320/390 px.

## Certificación final del 2026-07-21

- 6/6 viewports PASS: 320×640, 375×667, 768×1024, 1024×768, 1366×768 y 1920×1080.
- 84 auditorías de ruta/estado: 14 por viewport, con modo claro, modo oscuro, ruta inexistente y acceso denegado.
- 24 capturas de estados funcionales en `evidence/screenshots/2026-07-21/`, cada una acompañada por su JSON geométrico.
- 24/24 JSON con `horizontalOverflow=0`, sin errores de consola, `pageerror` ni solicitudes fallidas reales.
- Facturación documentada en vacío, carrito, pago y confirmación; caja abierta, diferencia y cierre; catálogo y edición; historial y reversa; tres reportes; respaldos; configuración fiscal; recibos normal/A5; usuarios; ayuda, soporte y acerca de.

Reporte estructurado: `evidence/logs/a11y-visible-ui-2026-07-21.json`.

## Controles accesibles

- landmarks y encabezados semánticos;
- labels asociados y errores anunciables;
- foco visible y restauración de foco de Radix;
- navegación por teclado en dialogs, sheets, menus, tabs y command palette;
- alternativas HTML para gráficos;
- encabezados reales para tablas;
- tiempos persistentes para errores críticos en Sonner;
- `prefers-reduced-motion` y targets táctiles;
- tests con axe/vitest-axe y reglas `jsx-a11y`.

Los PNG modificados localmente bajo `qa/operational-ux/after/` pertenecen al usuario y no se sobrescribieron ni se incluyeron en los commits de esta auditoría.
