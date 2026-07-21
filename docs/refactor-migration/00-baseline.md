# Línea base de la refactorización integral

Fecha de captura: 2026-07-21 (America/Tegucigalpa).

## Estado preservado

- Commit inicial: `1ad1ca8cc3c5aeaee69936bed5450982ede75186` (`test(release): require LAN asset helper offline`).
- Rama de trabajo: `codex/refactor-migration-integral-20260721`.
- El árbol inicial contenía 12 PNG modificados bajo `qa/operational-ux/after/`. Son evidencia del usuario y permanecen sin preparar.
- Snapshot externo: `C:\Users\melar\.codex\visualizations\2026\07\17\019f7211-1912-72b2-bf0d-37a8009949ee\refactor-migration-safety-20260721`.
- Patch binario: `pre-refactor-working-tree.patch`, SHA-256 `8A33FAF2BBAD98E34AC361BCB9B0065B9EA5F929C3F8EA29EB0C7DAB72580FF1`.
- Bundle Git completo: `pre-refactor-head.bundle`, SHA-256 `5135227F36416D7172C65EEAB6A500DD040A12F1D1A622B2E7B9C4C46D625539`.
- Se verificaron `git apply --reverse --check` y `git bundle verify`, ambos con código 0.

## Stack descubierto

| Capa | Versión/implementación |
|---|---|
| PHP | 8.3.32 en el contenedor |
| Laravel | 12 |
| Base de datos | MariaDB 11.8.8, conexión Laravel `mysql` |
| Node / npm | 22.18.0 / 11.6.2 |
| React | 19 |
| TypeScript | 5.9.3, modo estricto |
| Vite | 8.0.16 |
| Tailwind CSS | 4.3.0 |
| shadcn | 4.13.0, preset `radix-nova`, CSS variables, iconos Lucide |
| Datos frontend | TanStack Query 5.100.10 y TanStack Table 8.21.3 |
| Formularios | React Hook Form 7.76 y Zod 4.4.3 |
| Gráficos / avisos | Recharts 3.8 y Sonner 2.0.7 |
| Autorización | Sanctum 4, Spatie Permission 6, Policies explícitas |
| Documentos | DomPDF 3.1 y PhpSpreadsheet 5.7 |

## Arquitectura real

El despliegue Docker contiene `mysql`, `backend`, `frontend`, `queue-worker`, `realtime-worker` y `scheduler`. El frontend ya separa `components/ui`, `design-system`, `features`, `shell`, `hooks`, `lib/api` y navegación institucional. Las rutas visibles se cargan de forma diferida. El backend contiene 49 Actions, 25 Controllers, 66 Form Requests, 10 Policies, 3 Events, 7 middlewares propios, 81 migraciones y un Job. No existe una capa genérica `Services`; la lógica de aplicación se concentra deliberadamente en Actions.

Se localizaron 40 primitivas shadcn locales y 24 patrones/tokens de diseño. No hay imports de producción de Ant Design, AG Grid o ECharts. Sus nombres sólo aparecen en las pruebas y en el script que impide reintroducir dependencias heredadas. Recharts se encapsula en el componente shadcn `chart.tsx`.

## Flujos y controles existentes

- Facturación: cálculo central en centavos, creación transaccional, llave de idempotencia, reserva fiscal y snapshots de ítems.
- Caja: apertura, conciliación y cierre mediante Actions; la API expone la sesión como fuente de verdad.
- Pagos/anulaciones: Actions dedicadas, Policies/Gates y auditoría.
- Recibos: snapshot canónico, HTML, PDF, emisión, reserva, reimpresión, anulación y eventos de impresión.
- Reportes: servicios ejecutivo, operativo, caja, auditoría, PDF y Excel.
- Seguridad: Sanctum stateful, CSRF, rate limiting por usuario, cabeceras, bloqueo de login, usuario activo, cambio obligatorio de contraseña, idempotencia y saneamiento de errores en producción.
- Backups: creación/descarga, cifrado, checksums, retención, worker y scripts de restore.
- Offline/LAN: bundle de imágenes local y scripts PowerShell de instalación, actualización, diagnóstico, backup, restore y validación de cliente LAN.

## Datos y volumen de referencia

Las 81 migraciones figuran aplicadas. La base principal `hospital_billing` mide aproximadamente 20.53 MB. Conteos representativos: 19 usuarios, 145 servicios, 67 facturas, 77 líneas, 63 pagos, 7 sesiones de caja, 32 recibos institucionales, 56 registros de backup y 3273 eventos de auditoría. El servidor también conserva esquemas antiguos de validación/restore; no se eliminarán durante esta refactorización.

## Deuda y riesgos iniciales

1. Las vistas más grandes (`InvoiceHistoryView.tsx`, `InstitutionalReceiptSettingsView.tsx`, `NewInvoiceView.tsx`, `CashBoxView.tsx`) requieren extracción gradual, no reescritura.
2. Reportes y estado del sistema contienen clases de 30–50 KB; se revisarán por responsabilidades y consultas.
3. El esquema mantiene columnas DECIMAL históricas junto a columnas `*_cents`. La contracción sólo será posible después de verificación, compatibilidad y restore probado.
4. Las exportaciones de hoja de cálculo convierten centavos a valor numérico de celda. Esto es serialización de salida, no cálculo de dominio; se probará precisión y reconciliación antes de modificarla.
5. Existen conversiones históricas o de presentación con `float`; se clasificarán para eliminar cualquier uso monetario de dominio sin romper PDF/Excel ni dimensiones de papel.
6. La certificación física aún necesita impresoras Carta, Media Carta, A5, 80/58 mm y un segundo cliente LAN real.
7. Los 12 PNG modificados preexistentes no pueden atribuirse a este trabajo y se conservarán fuera de los commits.

## Línea base de calidad

La ejecución fresca de pruebas y gates se registra en `docs/refactor-migration/evidence/logs/`. Un gate no se marcará PASS hasta que exista comando, código de salida y artefacto reproducible. La prueba integral usa servicios Docker reales; los mocks sólo cuentan para aislamiento unitario.

