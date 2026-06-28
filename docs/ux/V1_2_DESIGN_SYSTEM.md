# V1.2 Design System

Fecha: 2026-06-26

Alcance: Fase 5 inicial del refactor UX/UI V1.2. Este documento cubre tokens y componentes compartidos. No autoriza cambios de backend, migraciones, payloads, calculos, permisos, PDF backend ni reglas de negocio.

## Principios

- Sistema institucional, sobrio y rapido para caja hospitalaria offline/LAN.
- Tailwind CSS v4 sigue siendo la fuente de tokens mediante `frontend/src/styles.css`.
- Los componentes compartidos son presentacionales: reciben datos ya resueltos por las pantallas o por la API.
- Dark mode y print deben conservar contraste y estructura.
- No se agregan librerias nuevas en esta fase.
- No se inventan KPIs, datos fiscales, codigos internos ni informacion legal.

## Tokens V1.2

Los tokens nuevos viven en `@theme` para poder usarse como utilidades Tailwind.

| Token | Uso |
| --- | --- |
| `--color-hospital-primary` | Acento institucional principal para iconos, barras de estado y enfasis operativo. |
| `--color-hospital-accent` | Acento secundario controlado para advertencias suaves o contraste puntual. |
| `--color-operational-bg` | Fondo general de superficies operativas. |
| `--color-operational-surface` | Superficie principal de paneles y herramientas. |
| `--color-operational-panel` | Fondo de previsualizaciones, zonas secundarias y agrupaciones. |
| `--color-operational-border` | Bordes de paneles operativos. |
| `--color-chart-1` a `--color-chart-6` | Series de Recharts y leyendas. La paleta mezcla verde institucional, azul, ambar, rosa, oliva y violeta controlado para evitar monocromo. |
| `--color-receipt-border` | Bordes de recibo/previsualizacion imprimible. |
| `--shadow-operational` | Sombra discreta para paneles que necesitan jerarquia. |
| `--radius-panel` | Radio estandar de panel operativo. |
| `--spacing-panel` | Padding estandar de panel operativo. |

Los tokens tienen valores para light mode, `html.dark` y `@media print`. En print, superficies y sombras se neutralizan para evitar recibos o reportes con fondos pesados.

## Componentes Compartidos

Todos los componentes nuevos estan en `frontend/src/components/shared/design-system.tsx` y se reexportan desde `frontend/src/components/shared/index.ts`.

| Componente | Uso recomendado |
| --- | --- |
| `AppSurface` | Raiz visual de una pantalla o modulo. Aplica fondo operativo y altura segura `100dvh`. |
| `PageShell` | Contenedor de pagina con ancho maximo, padding responsive y stack vertical. |
| `SectionHeader` | Encabezado de seccion con eyebrow, titulo, descripcion y acciones. |
| `CommandPanel` | Bloques de busqueda, filtros, comandos o formularios cortos. Incluye foco visible por `focus-within`. |
| `WorkflowPanel` | Paso de flujo operativo con estado, acciones, footer y tono visual. |
| `ChartCard` | Contenedor de graficos con `figure`, titulo accesible y alto minimo estable. |
| `StatGrid` | Grid responsive para metricas ya calculadas por backend o pantalla. |
| `InfoPanel` | Mensajes informativos, advertencias o errores no modales. Usa roles `status` o `alert` segun tono. |
| `PermissionState` | Estado visual para acceso restringido, solo lectura o accion no disponible. No decide permisos. |
| `OperationalBanner` | Banda superior para estado operativo o contexto de pantalla. |
| `CashStatusCard` | Tarjeta visual de estado de caja. No calcula saldos ni autoriza acciones. |
| `ReceiptDocumentShell` | Envoltura imprimible para contenido de recibo institucional en carta, media carta, A5, 80mm o 58mm. |
| `PrintPreviewFrame` | Marco de previsualizacion con controles externos y viewport imprimible. |

## Reglas de uso

- Importar desde `@/components/shared` cuando una pantalla necesite patrones operativos V1.2.
- Mantener el texto visible en espanol institucional y evitar datos tecnicos para usuarios normales.
- Pasar montos, estados, permisos y totales ya resueltos. Los componentes no deben recalcular impuestos, pagos, caja ni recibos historicos.
- Usar `actions` para botones reales con handlers definidos por la pantalla. No usar botones decorativos.
- Usar `ChartCard` con resumen textual, tabla o leyenda cuando el grafico represente datos relevantes.
- Usar `ReceiptDocumentShell` solo para frontend preview o impresion de UI; el PDF backend sigue siendo la fuente institucional del documento generado por servidor.
- Mantener iconos decorativos con `aria-hidden` o `data-icon`. Botones solo-icono deben tener `aria-label`.
- Evitar anidar paneles dentro de paneles salvo que sea un item repetido con jerarquia clara.

## Limites

- No usar estos componentes para cambiar contratos API, endpoints, reducers POS, payloads, calculos fiscales, numeracion, pagos, permisos o anulaciones.
- No insertar QR, codigos de barras, codigos internos ni datos fiscales inventados en recibos.
- No depender de CDN, fuentes remotas ni servicios SaaS para que la UI funcione en produccion LAN/offline.
- No usar colores crudos por pantalla si existe token semantico.
- No instalar librerias visuales nuevas sin actualizar `docs/ux/V1_2_LIBRARY_DECISION_RECORD.md` y `docs/DECISIONS.md`.

## Pruebas focales

Se agrego `frontend/src/components/shared/design-system.test.tsx` para validar:

- slots estables de `AppSurface`, `PageShell` y `SectionHeader`;
- paneles `CommandPanel`, `WorkflowPanel` y `ChartCard`;
- estados `InfoPanel`, `PermissionState`, `OperationalBanner`, `StatGrid` y `CashStatusCard`;
- hooks de impresion y formato en `PrintPreviewFrame` y `ReceiptDocumentShell`.

Los gates esperados para esta fase son:

```powershell
cd frontend
npm run typecheck
npm run lint
npm run test -- ui shared
npm run build
```
