# Plan de ejecución incremental

Este plan se ejecuta automáticamente en `codex/refactor-migration-integral-20260721`. Cada fase produce evidencia y un commit Conventional Commit independiente. Los PNG preexistentes del usuario quedan fuera de staging.

## Criterios globales

- No cambiar contratos públicos sin compatibilidad y prueba del consumidor.
- TDD para dinero, fiscalidad, caja, pagos, permisos, correlativos y eritropoyetina.
- No declarar listo un flujo sólo con API simulada.
- Backend decide importes y estados; frontend sólo presenta/previsualiza.
- Sin descargas ni SaaS obligatorios en operación LAN.
- Cada cierre de fase ejecuta gates focalizados y registra comando/código de salida.

## Fases

### 1. Línea base y guardas

Entregables: documentos 00–03, inventario de rutas/datos, logs frescos, verificación del guard de UI heredada y revisión de llamadas externas. Criterio: snapshot verificable y ninguna modificación del usuario incluida.

### 2. Contratos críticos del backend

Revisar dinero, idempotencia, transacciones, secuencia fiscal, caja única, Policies, auditoría y errores API. Primero agregar regresiones; después extraer responsabilidades de clases grandes sin cambiar respuestas. Criterio: pruebas unitarias/feature, Pint y PHPStan verdes.

### 3. Migraciones de datos seguras

Crear únicamente migraciones justificadas por evidencia. Añadir dry-run/verificación, conteos, sumas y checksums. Ejecutar contra copia anterior y base limpia; probar rollback/restore. Criterio: reconciliación exacta y reporte 06.

### 4. Shell, tokens y patrones

Auditar la implementación shadcn existente: tokens semánticos, foco, contraste, sidebar único, Sheet móvil, command palette, toasts, error boundary y estados de ruta. Consolidar, no sustituir código sano. Criterio: guards UI, pruebas de shell y axe focalizado.

### 5. Rutas operativas

Orden: autenticación → dashboard → nueva factura → caja → catálogo → historial. Extraer lógica de vistas monolíticas hacia hooks/componentes del feature. Verificar doble envío, stale requests, permisos, estados y móvil. Criterio: pruebas focalizadas y E2E real por flujo.

### 6. Documento canónico e impresión

Auditar que snapshot, preview, HTML, PDF, navegador y reimpresión consuman el mismo modelo. Mejorar composición de Carta/Media Carta/A5 y compatibilidad secundaria 80/58 mm sin IDs técnicos ni contenido de prueba. Criterio: snapshots, PDF parseado, hashes y prueba de navegador; impresión física se registra separadamente.

### 7. Reportes profesionales

Separar ejecutivo/caja/auditoría; corregir periodos y zona horaria; reconciliar KPIs/tablas/PDF/Excel; validar formula injection y volumen. Dividir servicios grandes sólo con cobertura. Criterio: mismos filtros y centavos en pantalla, PDF, Excel y SQL.

### 8. Administración y soporte

Configuración fiscal guiada, recibos institucionales, usuarios, backups, ayuda, soporte y acerca de. Resolver estados contradictorios y mensajes efímeros; proteger último administrador y acciones críticas. Criterio: permisos permitidos/denegados y estados accionables.

### 9. Accesibilidad, responsive y rendimiento

Ejecutar axe más revisión manual de teclado, foco, Escape, zoom 400 %, reduced motion y lector. Capturar 15 rutas en 8 viewports; revisar consola/red/overflow. Medir chunks, consultas y N+1 antes/después. Criterio: cero P0/P1 y evidencia 07–08.

### 10. Operación real y entrega

E2E real completo con MariaDB, concurrencia, backup/restore separado, instalación offline limpia, reinicio/persistencia, actualización/rollback, impresoras físicas y segundo cliente LAN. Criterio: matriz de Definition of Done con comando, exit code y ruta de evidencia. Lo que dependa de hardware externo se reportará como bloqueo real, nunca como PASS supuesto.

## Secuencia de commits prevista

1. `docs(refactor): capture repository baseline and migration plan`
2. `test(domain): add critical financial and concurrency regressions`
3. `refactor(backend): isolate verified domain boundaries`
4. `feat(data): add safe idempotent migration verification`
5. `refactor(ui): consolidate shell and shared route states`
6. commits por feature: `billing`, `cashbox`, `catalog`, `invoices`, `receipts`, `reports`, `admin`
7. `test(e2e): certify real hospital workflows`
8. `docs(release): record offline LAN and recovery evidence`

La secuencia puede dividirse más si un diff deja de ser revisable; no se mezclarán módulos no relacionados.
