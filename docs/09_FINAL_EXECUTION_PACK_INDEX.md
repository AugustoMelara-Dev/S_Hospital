# 09 Final Execution Pack Index

## Veredicto honesto

La critica de UX/UI es parcialmente cierta y comercialmente importante.

No es cierto que el sistema actual este literalmente en una sola pagina: el repo ya tiene `AppShell`, sidebar izquierdo, topbar, rutas por modulo y componentes base. Si es cierto que la experiencia de facturacion todavia no se siente como producto final de caja hospitalaria. La pantalla de nueva factura sigue dependiendo de una lista filtrable de servicios, no de un POS rapido por categorias, identificador de servicio, carrito y cobro guiado.

## Objetivo de esta fase final

Convertir el sistema de un core tecnico funcional a un producto institucional, verificable y operable en caja hospitalaria local.

El backend de facturacion, caja, pagos, historial, recibos, backups y reglas fiscales debe conservarse como fuente de verdad. La fase final reorganiza la experiencia visible, completa reportes avanzados, formaliza escaneo de servicios y deja QA de entrega.

## Carpetas canonicas

| Carpeta | Proposito | Uso obligatorio |
| --- | --- | --- |
| `docs/` | Documentos maestros de producto, UX, reportes, criterios y release | Leer antes de implementar cada fase |
| `prompts/` | Prompts agenticos para plan, review, implementacion y release | Ejecutar en orden antes de tocar codigo amplio |
| `codex-skills/` | Skills operativas locales para Codex | Usar como roles de trabajo por fase |
| `subagents/` | Revisores especializados | Ejecutar revision de plan y diff con los 8 subagentes |
| `UI/` | Wireframes, componentes y especificaciones de pantallas | Fuente principal para app shell, POS y reportes |
| `database/` | SQL critico, seed y extensiones de esquema | Validar migraciones contra este contrato |
| `devex/` | Instalacion, Docker y librerias UI | Usar para setup reproducible y librerias aprobadas |
| `branch/` | Estrategia de ramas y commits | Fase final siempre en `codex/*` |
| `references/` | Referencias tecnicas por dominio | Base para revisar arquitectura, DB, seguridad, UX, reportes y LAN |
| `scripts/` | Gates locales y validadores | Ejecutar antes de cerrar fases |
| `qa/` | Criterios de aceptacion y readiness | No cerrar fase si falla checklist critico |
| `workflows/` | Protocolos de ejecucion | Mantener disciplina de fase/commit/review |
| `worklogs/` | Registro de decisiones y avance | Agregar evidencia despues de cada fase |
| `subversion/` | Control de versionado, releases y congelamiento de entrega | Evitar mezcla de ramas, hotfixes improvisados y entregas sin tag |

## Fases finales canonicas

### 12A App shell y design system

Alcance:

- Consolidar sidebar izquierdo, topbar, rutas internas y layout persistente.
- Reducir `App.tsx` como orquestador, no como pantalla gigante.
- Adoptar componentes UI reutilizables y tipografia consistente.

Criterio:

- La app deja de sentirse como prototipo tecnico.

### 12B POS de facturacion

Alcance:

- Redisenar nueva factura como flujo POS.
- Paciente, busqueda, categorias, escaneo de servicios, servicios compactos, carrito, cobro y recibo.
- Mantener backend como fuente final de totales, precios y reglas.

Criterio:

- La cajera puede facturar rapido sin recorrer los 122 servicios.

### 12C Catalogo, categorias e identificadores

Alcance:

- Administrar categorias y servicios con busqueda/filtros reales.
- Agregar identificadores tecnicos de servicio si el backend todavia no los soporta.
- Validar unicidad, servicios activos y permisos.

Criterio:

- El catalogo es administrable y el POS puede agregar por categoria, texto o identificador.

### 12D Reportes avanzados

Alcance:

- Dashboard gerencial con KPIs, filtros, tablas y exportacion CSV.
- Ventas, caja, cajero, metodo, categorias, servicios top, anulaciones, reimpresiones y backups.
- Totales calculados/validados por backend.

Criterio:

- Reportes sirven para administracion real, no solo para validacion guiada.

### 12E QA final y entrega

Alcance:

- Smoke de navegacion.
- Flujo completo: abrir caja, crear factura, cobrar, imprimir, reimprimir, anular, reportar y backup.
- Revision visual, build y pruebas automatizadas.

Criterio:

- Producto institucional verificable hoy sin disculpas por UX.

## Documentos de entrada por fase

| Fase | Documentos base |
| --- | --- |
| 12A | `docs/02_UI_ARCHITECTURE.md`, `docs/05_DESIGN_SYSTEM_AND_LIBRARIES.md`, `UI/sidebar-navigation-spec.md`, `UI/component_inventory.md` |
| 12B | `docs/03_POS_BILLING_UX_SPEC.md`, `UI/pos-screen-spec.md`, `references/ui_ux_cashier_workflows.md` |
| 12C | `docs/06_SERVICE_SCAN_WORKFLOW.md`, `database/schema_extensions_for_barcode_reports.sql`, `references/barcode_qr_reference.md` |
| 12D | `docs/04_ADVANCED_REPORTS_SPEC.md`, `UI/reports-screen-spec.md`, `references/advanced_reports_reference.md` |
| 12E | `qa/FINAL_UX_ACCEPTANCE_CHECKLIST.md`, `qa/RELEASE_READINESS.md`, `docs/RELEASE_CHECKLIST.md` |

## Gates minimos antes de entrega

- `php artisan test --colors=never`
- `npm run build`
- `php artisan config:cache`
- Validar `/up`, `/login` y `/verify-email`
- Smoke navegador: dashboard, nueva factura, caja, catalogo, historial, reportes y backups
- Flujo caja: abrir caja, emitir factura, cobrar, imprimir, reimprimir
- Reportes: diario, rango, metodo, categoria, caja/cajero
- Backup: ejecutar, listar y documentar restauracion

## Reglas de cierre

- No cerrar una fase si solo se ve bonita pero no opera.
- No cerrar una fase si el boton visible no ejecuta un flujo real.
- No cerrar reportes sin filtros por fecha.
- No cerrar POS si requiere recorrer lista interminable.
- No cerrar catalogo sin categorias dominantes e identificadores planificados o implementados.
- No cerrar entrega si no hay evidencia en `worklogs/` y `qa/`.
