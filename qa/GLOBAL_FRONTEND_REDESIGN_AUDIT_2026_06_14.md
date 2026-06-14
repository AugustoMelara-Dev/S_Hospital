# Global Frontend Redesign Audit - 2026-06-14

## Estado

- Rama: `codex/f6-operational-polish`
- Commit base: `5259f052 docs(frontend): align global redesign plan`
- Stack local: `backend`, `frontend` y `mysql` activos con Docker Compose.
- URL frontend local: `http://127.0.0.1:5173`
- URL backend local: `http://127.0.0.1:8000`

## Alcance auditado

Pantallas reales incluidas en el rediseño global:

- Login.
- Cambio obligatorio de contraseña.
- Dashboard.
- Nueva factura / POS.
- Caja, apertura y cierre.
- Pagos.
- Historial de facturas.
- Reimpresión.
- Recibos institucionales.
- Catálogo.
- Reportes.
- Backups.
- Configuración fiscal.
- Usuarios y permisos.
- Ayuda.
- Acerca de.
- Estados vacíos, error, carga, permisos, modales, sheets, dropdowns y 404.

## Base técnica existente

El frontend ya incluye una base suficiente para un sistema de diseño propio:

- Tailwind CSS v4.
- Radix UI primitives.
- lucide-react.
- TanStack Query.
- React Hook Form.
- Zod.
- Recharts.
- react-hot-toast.
- react-to-print.
- Playwright.
- axe-core y vitest-axe.

No se detectó una necesidad inmediata de instalar librerías nuevas para Phase 1. `@tanstack/react-table` queda diferido hasta que tablas necesiten ordenamiento/columnas configurables/selección masiva.

## Hallazgos principales

### Global

- La paleta cálida actual domina demasiado el producto y puede sentirse menos clínica/institucional que una caja hospitalaria.
- El fondo cuadriculado global agrega ruido visual en pantallas densas.
- Existen colores literales (`amber`, `emerald`, `sky`, `slate`) que se saltan tokens y degradan dark mode.
- Hay texto visible con mojibake en varios componentes (`ConfiguraciÃ³n`, `Cargandoâ€¦`, etc.).
- Hay duplicación de patrones entre `table.tsx` y `data-table.tsx`, métricas locales y estados vacíos locales.

### Accesibilidad

- El menú de acciones en historial usa patrón custom y debe migrarse a Radix DropdownMenu o implementar ARIA completo.
- Formularios de usuarios y cambio de contraseña necesitan `aria-invalid`, `aria-describedby` y `role="alert"` para errores.
- El token warning actual no cumple contraste AA en texto normal.
- El sidebar móvil necesita botón visible de cerrar.
- El radiogroup de categorías en POS necesita navegación con flechas o convertirse a patrón más simple.
- Tablas financieras deben declarar `scope="col"` en headers.
- Algunas transiciones usan `transition-all`; se deben listar propiedades explícitas.

### Pantallas críticas

- POS y caja tienen buena base, pero requieren jerarquía más fuerte para requisitos, CTA, totales, cierre, diferencia y estados de caja.
- Reportes necesitan mejores acciones persistentes y jerarquía visual para filtros/exportaciones.
- Backups necesita estado ejecutivo primero y diagnóstico avanzado después.
- Configuración fiscal debe separar mejor riesgo institucional, fiscal, secuencia, impuesto y recibo.
- Recibo debe mantener estética institucional impresa, no absorber el tema visual de la app.

## Evidencia visual existente

Hay evidencia histórica en:

- `qa/screenshots/rc-e2e-2026-06-09-*.png`
- `qa/screenshots/before/`
- `qa/screenshots/after/`
- `qa/screenshots/phase-12-visual-smoke/`
- `qa/screenshots/smoke/`

Estas capturas no deben sobrescribirse durante el rediseño global. Nuevas capturas deben guardarse en directorios dedicados de before/after.

## Intentos de captura de baseline

Comando intentado con Playwright mockeado:

```powershell
cd C:\Projects\S_Hospital\frontend
$env:PLAYWRIGHT_EXTERNAL_SERVER='1'
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:5173'
$env:E2E_CAPTURE_SCREENS_DIR='C:\Projects\S_Hospital\qa\screenshots\before-redesign-2026-06-14'
npm.cmd run e2e -- rc-screens.spec.ts
```

Resultado:

- Primer intento falló con `ENOENT` porque el spec no crea la carpeta destino.
- Se creó `qa/screenshots/before-redesign-2026-06-14`.
- Segundo intento falló con `EPERM` al escribir PNG.

Comando intentado con smoke F6:

```powershell
cd C:\Projects\S_Hospital
$env:F6_VISUAL_BASE_URL='http://127.0.0.1:5173'
$env:F6_VISUAL_USER='admin.validacion'
$env:F6_VISUAL_PASSWORD='Password123!'
$env:F6_VISUAL_OUTPUT_PHASE='C:\tmp\s_hospital_before_redesign_2026_06_14'
$env:F6_VISUAL_FULL='1'
node qa\visual-smoke\f6-operational-polish.mjs
```

Resultado:

- Falló con `EPERM` al crear `C:\tmp\s_hospital_before_redesign_2026_06_14`.

Conclusión: la línea base visual existe en capturas históricas, pero la captura fresh queda bloqueada por permisos de escritura de Playwright/Node en este entorno. Se reintentará en Phase 9/10 si el destino de escritura queda disponible.

## Comandos ejecutados

```powershell
docker compose up -d
docker compose exec backend php artisan migrate --seed
docker compose ps
git status --short
```

Resultados:

- Docker Compose levantó `mysql`, `backend` y `frontend`.
- Migraciones: `Nothing to migrate`.
- Seeders ejecutados: `RolesAndPermissionsSeeder`, `ServiceCatalogSeeder`, `DevelopmentValidationSeeder`.
- `mysql` aparece healthy.

## Decisión Phase 0

APROBADO CON CAMBIOS.

Se puede avanzar a Phase 1 con estas condiciones:

- No pisar capturas existentes.
- No instalar librerías nuevas sin justificación de uso real.
- Corregir contrastes y estados de foco desde la base de diseño.
- Mantener recibos e impresión aislados.
- Mantener contratos Laravel/API sin cambios.

