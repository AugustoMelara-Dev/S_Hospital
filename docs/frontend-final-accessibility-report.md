# Certificación final de accesibilidad y QA visual

## Cobertura

La matriz se extrajo de `AppRoutes.tsx` y se ejecutó en Chromium real. Cubrió 13 rutas protegidas y tres estados de autenticación con siete variantes por recorrido: claro 1366×768, oscuro 1366×768, claro 1920×1080, oscuro 1920×1080, claro 390×844, oscuro 390×844 y zoom 125 %.

Rutas protegidas: `/about`, `/admin/users`, `/backups`, `/billing/new`, `/cashbox`, `/catalog`, `/dashboard`, `/help`, `/invoices`, `/reports/executive`, `/settings/fiscal`, `/settings/institutional-receipts` y `/support`.

Estados de autenticación: Login, cambio obligatorio de contraseña y sesión expirada.

## Resultado axe

| Clasificación | Resultado |
|---|---:|
| minor | 0 |
| moderate | 0 |
| serious | 0 |
| critical | 0 |
| incomplete sin clasificar | 0 |

Axe produjo 191 nodos `incomplete` por cálculo de contraste con fondos compuestos. Cada nodo quedó clasificado individualmente en su JSON de evidencia con selector, HTML, color computado, fondo efectivo y ratio; todos alcanzan al menos 4.5:1. No quedó ningún incomplete sin análisis.

## Resultado visual y de interacción

- 112 capturas PNG y 112 archivos JSON: 91 de rutas protegidas y 21 de autenticación.
- 1,225 superficies inspeccionadas por computed style; radios distintos de `0px`: 0.
- Overflow horizontal: 0.
- Controles interactivos sin nombre accesible: 0.
- Errores de consola: 0; `pageerror`: 0; solicitudes fallidas o inesperadas: 0.
- Los recorridos validan foco, teclado, Escape, portales, overlays, restauración de foco, labels, zoom, modo oscuro y reducido movimiento.

## Evidencia ejecutable

Comando:

```powershell
$env:PLAYWRIGHT_PORT='4182'; npx playwright test e2e/accessibility.spec.ts --project=chromium --grep "complete visual and axe matrix|authentication visual matrix" --reporter=line
```

Resultado: 4/4 pruebas aprobadas en 479.1 s.

Artefactos persistentes: `frontend/artifacts/frontend-final/`.
