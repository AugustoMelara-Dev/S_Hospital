# Certificación final de accesibilidad y QA visual

Fecha: 2026-07-14.

## Cobertura

La matriz se extrajo de `AppRoutes.tsx` y se ejecutó en Chromium real. Cubrió 14 destinos protegidos/fallback y tres estados de autenticación con siete variantes por recorrido: claro 1366×768, oscuro 1366×768, claro 1920×1080, oscuro 1920×1080, claro 390×844, oscuro 390×844 y zoom 125 %.

Rutas protegidas/fallback: `/about`, `/admin/users`, `/backups`, `/billing/new`, `/cashbox`, `/catalog`, `/dashboard`, `/help`, `/invoices`, `/reports/executive`, `/settings/fiscal`, `/settings/institutional-receipts`, `/support` y `/ruta-no-existente` (404).

Estados de autenticación: login, cambio obligatorio de contraseña y sesión expirada.

## Resultado

| Clasificación | Resultado |
|---|---:|
| minor | 0 |
| moderate | 0 |
| serious | 0 |
| critical | 0 |
| nodos incomplete | 191 |
| incomplete clasificados | 191 |
| incomplete sin clasificar | 0 |

Los incompletes corresponden a cálculo de contraste con fondos superpuestos o pseudo-elementos. Cada nodo conserva selector, HTML, color computado, fondo efectivo, ratio y análisis en el JSON de evidencia; los ratios efectivos cumplen al menos 4.5:1.

- 119 capturas PNG y 119 informes JSON versionados.
- 1,258 superficies inspeccionadas; radios distintos de `0px`: 0.
- Overflow horizontal: 0.
- Violaciones axe reales: 0.
- Errores de consola, `pageerror`, requests fallidos o inesperados: 0.
- Matriz completa: 4/4 pruebas aprobadas en 356 s.
- Playwright mock completo posterior al merge: 39/39 en 131.0 s.

## Verificación UX operativa posterior

La campaña posterior revalidó el shell normal, cinco paletas en claro/oscuro, paleta persistida inválida, rail contraído, menú de usuario, paleta de comandos, recorrido guiado, 390×844, navegación móvil, 1366×768 con zoom 125 % y 1920×1080. Una regresión real de contraste (`#5eead4` sobre blanco, 1.47:1) fue reproducida, corregida a la paleta clara (`#0f766e`) y cubierta por test. Resultado final: 0 violaciones reales. Los incompletes de overlays conservan clasificación manual con fondo efectivo y ratios 5.47:1, 6.92:1, 7.58:1 o 16.27:1; 0 permanecen sin clasificar.

Evidencia: `frontend/artifacts/frontend-final/`.
