# Auditoría de accesibilidad del shell institucional

Fecha de corte: 2026-07-13
Estado: **CORREGIDO EN EL ALCANCE DEL SHELL — REGRESIÓN GLOBAL PENDIENTE**

## Alcance y criterio

La auditoría cubre `InstitutionalShell`, `InstitutionalRail`, `InstitutionalMobileNav`, `ContextBar`, `CommandPalette`, `UserMenu`, `PageHeader` de la ruta Dashboard, breadcrumbs y los overlays reales de Ant Design consumidos por el shell. Se exige WCAG 2.2 AA: ratio 4.5:1 para texto normal, 3:1 para texto grande y 3:1 para indicadores visuales/foco no textuales.

El diagnóstico se realizó con Chromium + axe-core y estilos computados. No se deshabilitó `color-contrast` en las pruebas nuevas del shell. La primera ejecución produjo 25 nodos con contraste insuficiente; las iteraciones de tema oscuro y branding revelaron cuatro combinaciones adicionales. No se agregaron excepciones por ruta.

## Violaciones encontradas antes de la corrección

| Selector o superficie | Componente / estado | Tema | Texto | Fondo | Ratio anterior | Requerido | Token o causa responsable |
| --- | --- | --- | --- | --- | ---: | ---: | --- |
| `[data-testid="institutional-rail"] .text-sidebar-primary` | marca del rail expandido | teal claro | `#0f766e` | `#172033` | 2.97 | 4.50 | `--color-sidebar-primary` recibía el primario oscuro sin ajuste para el rail |
| `[data-testid="institutional-rail"] nav a` (10 nodos) | links inactivos/activos/hover | teal claro | `#0369a1` | `#172033` | 2.74 | 4.50 | `colorLink` de Ant sobrescribía el foreground semántico de navegación |
| `.ant-tag-processing` | estado de caja | claro | `#0369a1` | `#cadce0` | 4.18 | 4.50 | derivados automáticos de `colorInfo` sin pareja explícita texto/fondo |
| `[aria-label="Abrir comandos"] .ml-auto` | indicación `Ctrl K` | claro | `#90a1b9` | `#f8fafc` | 2.51 | 4.50 | literales `text-slate-400` y `bg-slate-50` |
| `.ant-typography-secondary`, breadcrumbs y descripciones (10 nodos) | texto secundario/terciario | claro | `#979ba3` | `#ffffff` | 2.78 | 4.50 | ausencia de `colorTextSecondary` y `colorTextTertiary` institucionales explícitos |
| `.ant-tag-success` (2 nodos) | tag/badge success | claro | `#15803d` | `#b4bfb6` | 2.64 | 4.50 | mezcla derivada de success sobre el fondo no institucional |
| `header`, `[aria-label="Abrir menu de usuario"]` | ContextBar/UserMenu | oscuro | `#f8fafc` | `#ffffff` | 1.04 | 4.50 | `bg-white` local rompía el tema oscuro |
| `.ant-tag-processing` | estado de caja | oscuro | `#33a4d6` | `#0c4a6e` | 3.34; luego 4.20 | 4.50 | semilla de info oscura insuficiente y derivados automáticos |
| `nav[aria-label="Accesos móviles"] a` | navegación móvil | teal claro | `#0f766e` | `#172033` | 2.97 | 4.50 | `colorLink` de Ant sobrescribía el token del dock |
| `.ant-list-item [data-active] .uppercase` | grupo activo de Command Palette | claro | `#dbeafe` | `#0f766e` | 4.48 | 4.50 | literal `text-blue-100` en selección primaria |
| links y foco primario | indigo oscuro | `#6366f1` | `#0f172a` | 4.00 | 4.50 | paleta de branding sin validación AA contra la superficie oscura |
| links primarios | teal oscuro | `#14b8a6` | `#1e293b` | 4.45 | 4.50 | semilla de branding demasiado cercana al umbral |

## Corrección central aplicada

- Se separaron las variables fuente `--institutional-*` de los aliases Tailwind `--color-*`. La definición anterior se referenciaba a sí misma y dejaba tokens semánticos inválidos.
- `createInstitutionalTheme` ahora define explícitamente fondos, texto principal/secundario/terciario, bordes, primary text/background y pares de success, warning, error e info para claro y oscuro.
- Las cinco paletas usan tonos oscuros AA: teal `#2dd4bf`, blue `#7dd3fc`, green `#34d399`, indigo `#a5b4fc`, rose `#fda4af`.
- El rail usa una variante clara segura sobre `#172033`; sus ratios actuales son teal 11.00, blue 9.76, green 10.67, indigo 8.16 y rose 8.60.
- Branding desconocido, inválido o de bajo contraste se normaliza a `teal` antes de acceder a tokens o persistirlo. La aplicación ya no falla por una clave inválida de `localStorage`.
- ContextBar, UserMenu y Command Palette consumen superficies y foregrounds semánticos. No contienen nuevos hexadecimales de ruta.
- `GuidedTour` dejó de consumir Dialog/Button legacy y Lucide; usa `Modal`, `Button` e iconos reales de Ant Design.
- La navegación conserva su foreground institucional mediante reglas centrales de integración Ant/Tailwind, sin inferencias por texto visible.

Ratios de referencia después de la corrección:

| Pareja semántica | Claro | Oscuro |
| --- | ---: | ---: |
| texto principal / container | 16.27 | 13.98 |
| texto secundario / container | 7.58 | 9.85 |
| texto terciario / container | 5.90 | 8.11 |
| info / fondo info | 6.59 | 8.24 |
| success / fondo success | 6.49 | 8.30 |
| foco teal claro / container | 5.47 | — |
| foco indigo oscuro / layout | — | 8.96 |

## Matriz de componentes y estados

| Superficie | Normal | Activo/seleccionado | Hover | Focus/teclado | Disabled | Claro/oscuro | Evidencia |
| --- | --- | --- | --- | --- | --- | --- | --- |
| InstitutionalShell | sí | n/a | n/a | skip-link visible | n/a | sí | axe sin violaciones shell |
| InstitutionalRail | sí | sí | sí | botón y links | botón colapso según estado | sí | expandido/colapsado; cuatro radios 0px |
| InstitutionalMobileNav | sí | sí | sí | links y botón Más | n/a | sí | 390×844, Drawer real, Escape y retorno de foco |
| ContextBar | sí | caja abierta/cerrada | botones | ring visible | n/a | sí | axe, Tooltip y estilos computados |
| CommandPalette | sí | fila activa | filas | flechas, Enter, Escape | resultado vacío no accionable | sí | Modal real, estructura List válida, retorno de foco |
| UserMenu | sí | menú abierto | items | Enter/Espacio/Escape | n/a | sí | Dropdown real, portal, retorno de foco |
| GuidedTour | sí | paso actual | botones | Escape y trap de Modal | botón Anterior inicial | sí | Modal real, callbacks, navegación, radios 0px |
| PageHeader | sí | n/a | acciones | orden de tab | acciones según permisos | sí | Dashboard bajo las 12 combinaciones |
| Breadcrumbs | sí | `aria-current` | links | navegación por teclado | ruta no autorizada no enlazada | sí | Ant Breadcrumb dentro de ContextBar |
| Botones primarios/secundarios | sí | active token | sí | indicador visible | opacidad + semántica nativa | sí | Ant Button y tokens centrales |
| Links | sí | `aria-current` | sí | indicador visible | n/a | sí | rail, dock, breadcrumbs |
| Badges/Tags | sí | processing/success/error | n/a | n/a | n/a | sí | pares explícitos y axe |
| Menús | sí | item actual | sí | teclado/Escape | items por permiso | sí | Dropdown y Command Palette |

`Popover` no tiene un consumidor runtime dentro del shell actual. Su excepción técnica es únicamente de instanciación: el token central `Popover.borderRadiusLG = 0` y el z-index se validan por unidad; no se añadió un Popover artificial al producto para satisfacer una prueba. Cuando exista un consumidor real deberá incorporarse a la prueba Chromium de estilos computados antes de declararlo certificado.

## Radios, sombras, gradientes y portales

Chromium valida `borderTopLeftRadius`, `borderTopRightRadius`, `borderBottomLeftRadius` y `borderBottomRightRadius` en rail, Dropdown/UserMenu, Modal/Command Palette, Modal/GuidedTour, Tooltip, Drawer móvil y panel del tour. Todos son `0px`.

También se verifica `backgroundImage: none` y ausencia de sombra con opacidad visible. Tailwind puede serializar `shadow-none` como capas RGBA de alfa 0; el test las clasifica correctamente como no visibles. No se detectaron gradientes, glassmorphism, pills, cards flotantes ni sombras decorativas en las superficies medidas.

## Ejecuciones verificadas

```text
npx vitest run src/features/onboarding/GuidedTour.test.tsx
3/3 passed

npx vitest run src/features/onboarding/GuidedTour.test.tsx \
  src/design-system/tokens/institutional-tokens.test.ts \
  src/design-system/themes/institutionalTheme.test.ts \
  src/hooks/useTheme.test.tsx
17/17 passed después de corregir la aserción de visibilidad animada

PLAYWRIGHT_EXTERNAL_SERVER=1 npx playwright test e2e/accessibility.spec.ts \
  --project=chromium -g "institutional shell reports|all supported branding|real shell overlays|mobile navigation"
4/4 passed en 1.4 min
```

Cobertura Playwright: teal/blue/green/indigo/rose/branding inválido × claro/oscuro; sidebar expandido/colapsado; navegación móvil; UserMenu; Command Palette; GuidedTour; Tooltip; PageHeader y breadcrumbs de Dashboard; teclado; foco visible; Escape; 390×844; 1366×768; 1920×1080; zoom CSS 125 %; axe normal y con overlays abiertos. La corrida adjunta screenshots de teal claro/oscuro, los tres viewports y el Drawer móvil abierto al reporte Playwright.

Resultado axe antes: 25 nodos `color-contrast` en la corrida base, más cuatro combinaciones de tema descubiertas en la matriz.
Resultado axe después: 0 violaciones de contraste y 0 violaciones serious/critical en los estados shell cubiertos.

La certificación transversal sigue pendiente. El shell conserva 0 violaciones serious/critical en los estados cubiertos, pero la regresión segmentada encontró 21 fallos en 9 archivos no migrados (Reportes, Ajustes de Recibos, App, API system y política de papel). El gate estricto está verde para Facturación, Catálogo y Administración; el inventario final continúa en 190/409. `npm run test:e2e` no puede iniciar sin la credencial de seed release obligatoria.
