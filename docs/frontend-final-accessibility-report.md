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
- Playwright mock completo: 39/39 en 116.2 s.

Evidencia: `frontend/artifacts/frontend-final/`.
