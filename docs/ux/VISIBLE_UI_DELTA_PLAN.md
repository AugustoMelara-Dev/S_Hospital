# Visible UI Delta Plan

Este plan aplica solo si el usuario confirma que esta viendo `http://192.168.1.10:8081`, el stack fue reconstruido/validado y aun asi percibe que "se mira igual".

No es autorizacion para implementar. Es una propuesta de fase futura.

## Diagnostico

V1.1 mejoro accesibilidad, copy institucional, responsive, recibos, reportes y robustez de componentes. La evidencia muestra que en `8081` las capturas son visualmente casi iguales a `qa/screenshots/v1-1-production-polish`, por lo que el problema no es una rama visual faltante.

El delta V1.1 fue sobrio y operacional. Para que el usuario perciba un cambio fuerte se necesita una fase visual deliberada, no otro merge forense.

## Fase propuesta

Commit sugerido:

`feat(ui): apply visible institutional dashboard and cashier polish`

## Cambios recomendados

| Prioridad | Pantalla | Problema visual especifico | Cambio visible | Archivos probables | Riesgo | Pruebas |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | Dashboard | Se ve correcto pero demasiado parecido a la version anterior: cards blancas, jerarquia conservadora. | Crear banda superior operacional con estado de caja, turno, acciones primarias y resumen diario mas claro. | `frontend/src/features/dashboard/**`, `frontend/src/layout/**`, `frontend/src/styles.css` | Medio: no inventar KPIs ni cambiar contratos. | Vitest dashboard, Playwright screenshot desktop/mobile. |
| P1 | Nueva factura | El POS sigue sobrio; el usuario puede no notar cambio. | Reforzar flujo de caja: busqueda prominente, carrito mas contrastado, total y accion de cobro como ancla visual. | `frontend/src/features/invoices/**` | Medio: no duplicar calculo fiscal. | Tests existentes de billing, screenshot billing empty/cart/mobile. |
| P1 | Reportes | Pantalla densa con cambios sutiles. | Encabezado de filtros mas claro, tabs con estado visual fuerte y paneles de totales mas escaneables. | `frontend/src/features/reports/**` | Bajo/Medio: mantener accesibilidad de charts. | `v1-1-full-a11y`, reports component tests. |
| P2 | Recibos settings | Preview formal pero poco protagonista. | Hacer preview institucional mas grande y con selector de formato evidente. | `frontend/src/features/receipt-settings/**` | Bajo: no cambiar PDF backend. | Receipt settings tests, screenshot preview. |
| P2 | Login | Ya se ve institucional, pero puede sentirse austero. | Agregar senal institucional mas fuerte sin hero comercial: encabezado con nombre del hospital, estado LAN y version. | `frontend/src/features/auth/LoginView.tsx` | Bajo. | Login tests, screenshot light/dark/mobile. |
| P2 | Usuarios/Admin | Tabla clara pero poco distintiva. | Mejorar agrupacion por rol/modulo y estados de acceso. | `frontend/src/features/users/**` | Medio: no debilitar RBAC. | Users tests, RBAC E2E. |

## Criterios de aceptacion

- El usuario puede distinguir visualmente antes/despues en dashboard, nueva factura y reportes.
- No se cambian reglas fiscales, pagos, caja, permisos, numeracion ni endpoints.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` pasan.
- Playwright captura dashboard, billing, reports, receipt settings y login en desktop/mobile.
- `docs/DECISIONS.md` registra que el cambio es visual, no funcional.

## Riesgos

- Un cambio demasiado decorativo puede afectar velocidad de caja.
- Un rediseño grande puede ocultar acciones criticas.
- Si se toca POS, hay que proteger teclado, foco, total y boton de cobro.

## Decision requerida

Antes de implementar, elegir alcance:

1. Solo dashboard + nueva factura.
2. Dashboard + nueva factura + reportes.
3. Matriz completa de pantallas V1.1.
