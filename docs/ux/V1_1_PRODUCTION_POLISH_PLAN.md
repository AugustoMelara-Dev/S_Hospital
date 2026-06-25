# S_Hospital V1.1 Production Polish Plan

Fecha: 2026-06-25
Rama base: `origin/main`
SHA base: `2e1949e6e1cccbccf8ae5c94a9472739fd0d14ac`
Rama de trabajo: `codex/v1-1-production-polish`
Worktree: `C:\Projects\S_Hospital-v1-1-polish`

## 1. Resumen ejecutivo

V1.1 es un pulido premium de produccion interna para convertir S_Hospital en un sistema hospitalario local robusto, sobrio, accesible y presentable sin cambiar contratos contables, permisos, numeracion fiscal, snapshots historicos ni reglas de caja/pagos.

El alcance es evolucionar el producto existente mediante fases pequenas: investigacion oficial, decision de dependencias, auditoria modulo por modulo, mejoras del design system, factura/recibo institucional, reportes, POS/caja, admin/auth, operaciones, responsive/a11y/performance y QA final. No se declara go-live fisico sin segunda PC LAN, impresora real, restore real descartable y carga LAN real.

## 2. Suposiciones explicitas

- Produccion sigue siendo offline LAN, sin CDN ni SaaS obligatorio.
- Backend Laravel sigue siendo fuente de verdad para precios, ISV, pagos, caja, anulaciones, recibos y permisos.
- Frontend solo previsualiza estados; no modifica reglas fiscales ni recalcula historicos.
- El stack actual se conserva por defecto: React, TypeScript, Tailwind CSS v4, Radix UI, componentes locales estilo shadcn, Recharts, TanStack Query, React Hook Form, Zod, Playwright y Vitest.
- No se agregan dependencias salvo justificacion documentada y pruebas de bundle/offline.
- Las ramas historicas no se fusionan ni se recuperan.
- Las validaciones fisicas quedan pendientes hasta ejecutarse en ambiente real.

## 3. Preguntas bloqueantes

No hay preguntas bloqueantes para planificar ni para iniciar fases documentales/auditoria. La decision operativa pendiente se mantiene como supuesto seguro: no declarar aprobacion fisica hasta que operaciones valide hardware real.

## 4. Arquitectura propuesta

### Frontend

- Mantener la arquitectura React/Vite existente y consolidar tokens en `frontend/src/styles.css`.
- Extender componentes compartidos en `frontend/src/components/ui/**` y `frontend/src/components/shared/**` antes de hacer ajustes por pantalla.
- Usar Radix para dialogos, alert dialogs, selects, tabs, tooltips, popovers y sheets, preservando focus management.
- Mantener Recharts para reportes con `ResponsiveContainer`, tooltips institucionales, legends claras, estados vacios y capa accesible cuando aplique.
- Mantener tablas semanticas existentes; evaluar TanStack Table solo si ordenamiento/visibilidad/seleccion superan el DataTable propio.

### Backend

- No cambiar contratos de API por estetica.
- Mantener recibo institucional PDF desde snapshots.
- Cualquier ajuste PDF/print debe respetar datos fiscales existentes, no inventar RTN, CAI, sellos ni firmas.
- Mantener DB transactions para pagos, caja, anulacion y recibos.

## 5. Modelo de datos y migraciones

No se esperan migraciones en las fases iniciales de investigacion, decision de dependencias, auditoria visual, design system frontend, reportes visuales, admin UX ni operaciones UX.

Migraciones solo se aceptan si una fase descubre un gap funcional real de seguridad, auditoria, indice de rendimiento o configuracion indispensable. En ese caso deben ser aditivas, idempotentes y acompanadas de tests backend.

## 6. Modulos y fases

| Fase | Alcance | Archivos esperados | Migraciones | Pruebas | Riesgos | Criterio de aceptacion |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | Verificar main, SHA, git limpio y checkpoint remoto | Git remoto/checkpoint | No | `git status`, rev-parse, log | Trabajar desde base incorrecta | Checkpoint remoto creado desde SHA esperado |
| 1 | Crear worktree y rama maestra | `C:\Projects\S_Hospital-v1-1-polish` | No | `git status`, branch, push | Rama existente o worktree sucio | Rama subida y worktree limpio |
| 2 | Investigacion web oficial | `docs/ux/WEB_RESEARCH_DESIGN_REFERENCES.md` | No | Revision documental | Usar fuentes dudosas | Fuentes oficiales/primarias con decision aplicable |
| 3 | Decision de librerias | `docs/ux/DEPENDENCY_DECISION_RECORD.md` | No por defecto | `npm audit` solo si se instala algo | Agregar peso offline innecesario | Mantener stack salvo beneficio claro |
| 4 | Auditoria visual por modulo | `docs/ux/MODULE_UX_UI_AUDIT.md` | No | Playwright screenshots si servidor corre | Diagnostico superficial | Cada ruta activa clasificada P0/P1/P2 |
| 5 | Coordinacion de subagentes | `docs/ux/subagents/COORDINATION_BOARD.md` | No | Handoff por rama | Conflictos entre worktrees | Zonas de archivo permitidas/prohibidas claras |
| 6 | Reglas de trabajo paralelo | Reportes subagente | No | Tests focales por rama | Mezclar modulos | Handoffs limpios antes de integrar |
| 7 | Design system premium | `frontend/src/styles.css`, `frontend/src/components/ui/**`, `docs/ux/DESIGN_SYSTEM_V1_1.md` | No | UI tests, typecheck, lint, build | Romper consumidores | Componentes reutilizables, dark mode, focus visible |
| 8 | Factura/recibo profesional | `ReceiptPreview`, estilos print, PDF backend si aplica, `docs/ux/INVOICE_RECEIPT_PREMIUM_REVIEW.md` | No salvo gap | Receipt/PDF tests | Romper snapshots/CAI | Recibo formal, sin QR/barcode/IDs internos |
| 9 | Reportes premium | `ReportsView`, charts, tablas, `docs/ux/REPORTS_ANALYTICS_PREMIUM_REVIEW.md` | Solo indices si medido | Reports tests, chart UI tests | Inventar metricas | KPIs reales y estados claros |
| 10 | Nueva factura/POS | `NewInvoiceView`, `PaymentModal`, `InvoiceConfirmation` | No | NewInvoice/Payment tests | Cambiar reducer/payload | Flujo paciente-busqueda-carrito-total-cobro claro |
| 11 | Revision modulo por modulo | Docs, screenshots | No | Capturas antes/despues | Saltar pantallas secundarias | Todas las rutas activas revisadas |
| 12 | Performance LAN/offline | `docs/qa/V1_1_PERFORMANCE_LAN_REVIEW.md` | No | build, bundle, smoke | Sobreoptimizar | Rutas criticas sin regresion perceptible |
| 13 | Seguridad/RBAC/privacidad | Tests/docs si gaps | Posible aditiva | RBAC/IDOR tests | Pulido visual debilita seguridad | Sin P0/P1 de permisos |
| 14 | QA final | QA reports | No | typecheck, lint, test, build, backend, E2E | Entorno local incompleto | Gates documentados con PASS o bloqueo honesto |
| 15 | Evidencia visual | `qa/screenshots/v1-1-production-polish/**` | No | Playwright screenshot pass | Evidencia mock confundida con fisica | Manifest y capturas sin datos reales |
| 16 | Integracion | `codex/v1-1-production-polish-integration` | Segun ramas | Gates tras cada merge | Conflictos acumulados | Integracion ordenada y verde |
| 17 | Informe final | `docs/qa/V1_1_PRODUCTION_POLISH_FINAL_REPORT.md` | No | Revision final | Reporte exagerado | Estado APROBADO/LISTO/BLOQUEADO honesto |
| 18 | Criterios aprobacion | Checklist final | No | Matriz final | Aprobar con P0/P1 | Ningun P0/P1 abierto |
| 19 | Merge a main | main + checkpoint | No | Post-merge gates | Fusion prematura | Solo si integracion esta verde |

## 7. Plan de TDD/pruebas por fase

- Documentacion/auditoria: validar existencia, coherencia, links y ausencia de cambios funcionales.
- Design system: tests de componentes compartidos, `vitest-axe` para piezas criticas, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.
- Recibo/PDF: tests existentes de receipt/PDF, casos 1, 10, 40 y 100 items si el harness lo permite, print digital sin declarar hardware PASS.
- POS/pagos/caja: tests focales `NewInvoiceView`, `PaymentModal`, `CashBoxView`, backend payment/cash tests.
- Reportes: tests backend de totales, permisos/export; tests frontend de estados vacios/error/loading y charts.
- Seguridad: RBAC/IDOR, permisos de reportes, backup download, errores sanitizados.
- QA final: `npm run smoke:buttons`, `npx playwright test e2e/production-readiness.spec.ts`, `npm run test:e2e`, backend test suite.

## 8. Plan de commits

1. `docs(ux): plan v1.1 production polish`
2. `docs(ux): record official design research`
3. `docs(ux): decide v1.1 dependency strategy`
4. `docs(ux): audit active modules for polish`
5. `docs(ux): coordinate v1.1 polish subagents`
6. Fases de implementacion por modulo: design system, operations, admin/auth, invoice/receipt, reports, QA/performance/security.

## 9. Riesgos tecnicos y mitigaciones

- Riesgo: pulido visual cambia reglas contables. Mitigacion: no tocar actions/backend salvo gap probado; tests focales.
- Riesgo: dependencias nuevas rompen offline o bundle. Mitigacion: decision record antes de instalar y pruebas completas si se instala.
- Riesgo: subagentes pisan archivos compartidos. Mitigacion: coordination board con zonas permitidas.
- Riesgo: mocks se confunden con evidencia real. Mitigacion: reportes separan QA digital, LAN real, impresora fisica y restore real.
- Riesgo: recibo se vuelve informal o inventa datos. Mitigacion: usar snapshots/configuracion existente y placeholders de configuracion pendiente.

## 10. Criterios de aceptacion por fase

Cada fase debe cerrar con:

- Alcance cumplido y documentado.
- Archivos esperados presentes.
- Sin migraciones inesperadas.
- Pruebas focales ejecutadas o bloqueo explicado.
- Riesgos residuales registrados.
- `git status --short` limpio antes de avanzar o cambios listos para commit.

## 11. Comandos de verificacion

```powershell
git status --short
git diff --check
cd frontend
npm run typecheck
npm run lint
npm run test
npm run build
npm run smoke:buttons
npx playwright test e2e/production-readiness.spec.ts
npm run test:e2e
cd ..\backend
php artisan test --colors=never
```

## 12. Lista de archivos esperados por fase

- `docs/ux/V1_1_PRODUCTION_POLISH_PLAN.md`
- `docs/ux/V1_1_PRODUCTION_POLISH_PLAN_REVIEW.md`
- `docs/ux/WEB_RESEARCH_DESIGN_REFERENCES.md`
- `docs/ux/DEPENDENCY_DECISION_RECORD.md`
- `docs/ux/MODULE_UX_UI_AUDIT.md`
- `docs/ux/subagents/COORDINATION_BOARD.md`
- `docs/ux/DESIGN_SYSTEM_V1_1.md`
- `docs/ux/INVOICE_RECEIPT_PREMIUM_REVIEW.md`
- `docs/ux/REPORTS_ANALYTICS_PREMIUM_REVIEW.md`
- `docs/ux/ADMIN_AUTH_UX_REVIEW.md`
- `docs/ux/OPERATIONS_UX_REVIEW.md`
- `docs/qa/V1_1_POLISH_QA_REPORT.md`
- `docs/qa/V1_1_PERFORMANCE_LAN_REVIEW.md`
- `docs/qa/V1_1_PRODUCTION_POLISH_FINAL_REPORT.md`
- `qa/screenshots/v1-1-production-polish/manifest.json`
