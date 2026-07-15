# Gate de línea base — UX operativa

Fecha local: 15 de julio de 2026  
Rama: `codex/operational-ux`  
Commit verificado: `e638a11d`

## Resultado

La fase de reproducción y diagnóstico queda registrada, pero la interfaz no se
considera corregida. El código del worktree pasa el gate focalizado; la
aplicación real disponible en `http://127.0.0.1:5173` todavía corresponde a un
despliegue anterior y conserva solicitudes duplicadas y tiempos mayores de dos
segundos. Las deficiencias visuales se asignan a los planes de implementación
posteriores.

## Gate de código

| Comando | Salida | Resultado |
| --- | ---: | --- |
| `php artisan test --filter='CriticalLanPerformanceTest\|AuthTest\|SystemStatusTest\|ServiceCatalogTest'` | 87 pruebas, 524 aserciones | pasa |
| `vendor/bin/pint --test` | sin diferencias | pasa |
| `vitest run src/hooks/useServices.test.tsx src/lib/api/catalog.test.ts` | 9 pruebas | pasa |
| `npm run typecheck` | sin errores | pasa |
| `npm run lint` | sin errores | pasa |
| `npm run build` | 3974 módulos transformados | pasa con aviso de chunks mayores de 500 kB |
| `playwright test e2e/operational-ux-baseline.spec.ts --project=chromium` | 2 pruebas del contrato de auditoría | pasa |

El build mantiene un aviso de tamaño para los chunks de reportes y AG Grid. No
es un fallo del gate, pero debe revisarse durante la optimización de las rutas
administrativas.

## Rendimiento LAN observado antes del despliegue de la corrección

Fuente HTTP: [`critical-lan-timings.json`](critical-lan-timings.json). Solo se
ejecutó una iteración por endpoint, por lo que p50 y máximo coinciden.

| Endpoint | p50 | máximo | objetivo |
| --- | ---: | ---: | ---: |
| `GET /api/system/setup-status` | 1451 ms | 1451 ms | < 2000 ms |
| `POST /api/auth/login` | 3416 ms | 3416 ms | < 2000 ms |
| `GET /api/services?billing=1&search=glucosa&per_page=24` | 2108 ms | 2108 ms | < 2000 ms |

La repetición del gate en navegador real, el 15 de julio, falló con login en
5765 ms y `setup-status` en 8544 ms. Registró una solicitud de login, dos de
`setup-status` y una carga inicial de servicios sin búsqueda. La búsqueda
intencional no pudo completar mientras seguía pendiente esa carga. Este rojo se
mantiene hasta reconstruir/reiniciar el frontend y backend desde este worktree y
repetir la medición. La evidencia inicial detallada está en
[`critical-browser-baseline.json`](critical-browser-baseline.json).

## Matriz visual de facturación

Los PNG y JSON inmutables viven en [`before/billing`](before/billing). La
inspección humana está en [`before/visual-inspection.md`](before/visual-inspection.md).

| Caso | overflow horizontal | scrolls internos | acción principal disponible |
| --- | ---: | ---: | --- |
| 1920×1080 | 0 px | 0 | sí |
| 1366×768 | 0 px | 2 | sí |
| 1024×768 | 0 px | 1 | no |
| 768×1024 | 0 px | 0 | no |
| 390×844 | 0 px | 0 | no |
| 320×568 | 0 px | 0 | no |
| efectivo 125 % | 0 px | 1 | no |
| efectivo 200 % | 0 px | 0 | no |

No se observaron `console.error`, `pageerror` ni `requestfailed` en esos ocho
casos. Eso no compensa la ausencia de la acción principal ni los scrolls
anidados. La barra inferior móvil cubre contenido y a 320×568 la composición
vertical impide completar el flujo en el viewport inicial.

La automatización solo pudo simular los anchos efectivos de 125 % y 200 %; los
atajos de zoom enviados a Chrome 150.0.7871.115 no cambiaron el zoom real. El
pendiente manual y los intentos están documentados en
[`before/zoom-review.md`](before/zoom-review.md).

## Estados canónicos

Los 21 estados capturados están en [`before/canonical`](before/canonical), con
un PNG y un JSON por estado: login, dashboard, facturación vacía/con cuenta,
cobro, éxito, caja, catálogo, historial, reportes, respaldos, configuración y
usuarios. Esos archivos son la referencia para las comparaciones finales; no se
deben regenerar desde una implementación posterior.

## Rojos asignados a las siguientes fases

- Identidad y documentos: nombre institucional incompleto, activo oficial no
  verificado y área de marca aún no estabilizada.
- Shell: navegación demasiado ancha, jerarquía repetida y scroll independiente.
- Facturación/cobro: acción ausente bajo 1280 px, carrito sin Drawer operativo,
  barra inferior que tapa contenido, scrolls anidados y jerarquía de pago débil.
- Documentos: Carta, Media Carta, A5, 80 mm y 58 mm requieren plantillas y
  verificación de una página para facturas cortas.
- Grids, caja y catálogo: paginación/idioma, densidad, truncado y adaptación
  móvil pendientes.
- Configuración: títulos duplicados, resúmenes sobredimensionados y controles
  fuera del primer viewport pendientes.
- Red: medir nuevamente el despliegue real desde la rama corregida hasta lograr
  login, setup y búsqueda por debajo de 2000 ms sin duplicados.

## Criterio para cerrar esta línea base

La fase 1 permite avanzar porque cada defecto tiene evidencia y destino, no
porque los criterios finales ya estén satisfechos. El cierre total requiere
capturas `after/`, inspección visual lado a lado, zoom real, PDF en navegador y
el gate legacy completo.
