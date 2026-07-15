# Matriz de aceptación de evidencia visual

Estado de esta ejecución: **12/12 escenarios Playwright aprobados** en 44.2 s.

Comando ejecutado desde `frontend`:

```text
npx playwright test e2e/operational-ux-canonical.spec.ts --reporter=list
```

| Criterio | Estado | Evidencia o límite |
|---|---|---|
| Doce capturas before preservadas | Verificado | `before/originals/manifest.md` registra fuente, dimensiones y SHA-256. |
| Doce capturas after equivalentes y frescas | Verificado | `after/canonical/01-login.png` a `12-settings.png`; hashes en `final-comparison.md`. |
| Mapeo 1:1 de estados | Verificado | Login, dashboard, facturación vacía, resultados, carrito, caja resumen/movimientos/cierre, historial, catálogo entrada/filtrado y configuración. |
| Datos realistas sin placeholders | Verificado | Pacientes con acentos, facturas fiscales, caja #77, pagos en efectivo/transferencia, ISV y eritropoyetina L 25.00. |
| Capturas visualmente revisadas a imagen completa | Verificado | Se inspeccionaron manualmente las 12 before y las 12 after el 15-07-2026; hallazgos residuales están explícitos abajo. |
| Sin overflow horizontal del documento en las 12 capturas | Verificado | Cada llamada a `save()` compara `scrollWidth <= clientWidth` antes de escribir el PNG. |
| Sin endpoint no mockeado | Verificado | `installStrictMockGuard` falla el test ante cualquier `/api/*` inesperado. |
| Sin `console.error`, `pageerror`, request fallido, HTTP 500 inesperado ni warning de deprecación AntD | Verificado | Guard estricto activo en `beforeEach` y comprobado en `afterEach`; la ejecución terminó 12/12 verde. |
| Login sin error rojo durante estado inicial | Verificado | Captura 01 y aserción explícita de ausencia de “Validando credenciales”. |
| Paciente, búsqueda y cuenta visibles juntos en escritorio | Verificado | Captura 03, 1917×1027. |
| Resultados compactos y cuenta persistente | Verificado | Captura 04, cinco resultados visibles junto a la cuenta. |
| Carrito estrecho sin superposición y CTA visible | Verificado | Captura 05, 672×921; drawer con cantidad, totales y CTA. |
| Caja abre en Resumen | Verificado | Captura 06 y aserción `aria-selected=true`. |
| Movimientos sin paginación doble | Verificado visualmente | Captura 07; dos filas de altura natural y sin controles duplicados. |
| Cierre con bloqueos accionables junto al conteo | Verificado | Captura 08. |
| Historial con altura de contenido y una sola paginación | Verificado visualmente | Captura 09. |
| Número fiscal completo visible en Historial | Verificado | Captura 09 regenerada: ambos correlativos se leen completos. |
| Dashboard sin artefactos de lista | Verificado | Captura 02 regenerada: la cola usa iconos semánticos y no muestra ordinales aislados. |
| Catálogo sin métricas que desplacen la tabla | Verificado | Capturas 10 y 11. |
| Configuración con jerarquía H1 única y resumen denso | Verificado visualmente | Captura 12: el contexto de ruta es secundario y “Configuración hospitalaria” es el único H1. |
| Matriz completa 1920, 1600, 1366, 1280, 1024, 768, 390, zoom 125/200 y reflow 320 | Verificado | `operational-ux-accessibility.spec.ts` aprobó diez condiciones: siete viewports, equivalentes de zoom 125/200 y reflow 320×720, sin overflow de documento. |
| Teclado, foco visible, Escape y axe en superficies operativas | Verificado | La matriz responsive aprobó navegación por teclado y axe sin violaciones. Dos comprobaciones de contraste quedaron `incomplete` por elementos parcialmente ocultos del sidebar; su contraste calculado fue 16.27:1. Los tests de componentes cubren focus trap, restauración de foco y Escape. |
| PDF Carta, Media Carta, A5, 80 mm, 58 mm y personalizado | Verificado en generación y render | 30 combinaciones de 1, 5, 15, 30 y 60 ítems: 914 aserciones, paginación monótona, contenido único, encabezado repetible e inspección visual de primeras/últimas páginas. Véase `after/receipt-matrix/manifest.md`. |
| Laravel/MySQL/MariaDB real en LAN | **Pendiente** | La evidencia es mock determinista; no afirma integración real. |
| Impresora física | **Pendiente** | No verificado. |

## Gates de cierre ejecutados

- Frontend: TypeScript, ESLint, inventario UI (0 violaciones), Storybook 14/14 y build Vite.
- Vitest: regresión global 1,057/1,060 verde; las únicas tres expectativas antiguas se corrigieron y su repetición focal pasó 55/55. El segmento completo de facturación pasó 228/228.
- Playwright mock: shell 4/4, facturación/catálogo/admin 18/18 y recibos/reportes/soporte 27/27.
- Responsive/axe: diez condiciones requeridas, sin violaciones y sin overflow de documento.
- Backend: PHPUnit completo 881 pruebas, 6,598 aserciones y 12 skips condicionales; Pint y PHPStan sin errores.
- PDF focal: 26 pruebas/1,142 aserciones; matriz de 30 archivos/914 aserciones e inspección visual renderizada.

## Límites externos

La impresora física, sus márgenes no imprimibles y la integración LAN real con
MySQL/MariaDB siguen requiriendo validación en el hospital.

Esta matriz es deliberadamente parcial: registra exactamente lo observado y
probado, sin convertir una captura mockeada en evidencia de integración o de
impresión física.
