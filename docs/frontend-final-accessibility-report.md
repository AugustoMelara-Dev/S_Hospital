# Certificación final de accesibilidad y QA visual

Fecha: 2026-07-14.

## Cobertura

La matriz se extrajo de `AppRoutes.tsx` y se ejecutó en Chromium real. Cubrió 13 destinos protegidos y tres estados de autenticación con siete variantes por recorrido: claro 1366×768, oscuro 1366×768, claro 1920×1080, oscuro 1920×1080, claro 390×844, oscuro 390×844 y zoom 125 %.

Rutas protegidas: `/about`, `/admin/users`, `/backups`, `/billing/new`, `/cashbox`, `/catalog`, `/dashboard`, `/help`, `/invoices`, `/reports/executive`, `/settings/fiscal`, `/settings/institutional-receipts` y `/support`.

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

- 112 capturas PNG y 112 informes JSON versionados.
- 1,218 superficies inspeccionadas; radios distintos de `0px`: 0.
- Overflow horizontal: 0.
- Violaciones axe reales: 0.
- Errores de consola, `pageerror`, requests fallidos o inesperados: 0.
- Matriz completa: 4/4 pruebas aprobadas en 342.9 s.
- Playwright mock completo: 39/39 en 118.7 s.

Evidencia: `frontend/artifacts/frontend-final/`.
