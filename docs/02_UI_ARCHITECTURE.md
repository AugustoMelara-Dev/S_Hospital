# 02 UI Architecture

## Principio

La arquitectura visual debe comunicar sistema de caja hospitalaria, no demo tecnica. El usuario debe entrar y entender donde esta: Nueva factura, Caja, Catalogo, Historial, Reportes, Backups o Configuracion.

## App shell

El layout persistente debe incluir:

- Sidebar izquierdo con navegacion principal.
- Topbar con titulo de pantalla, usuario, caja activa, fecha/hora local y estado del servidor.
- Area central por ruta.
- Acciones principales consistentes por pantalla.
- Contenedor responsivo para escritorio LAN, con soporte minimo para tablet.

## Rutas internas sugeridas

- `/app` o `/dashboard`.
- `/billing/new` para Nueva factura / POS.
- `/cashbox` para Caja.
- `/catalog/categories` y `/catalog/services` para Catalogo.
- `/invoices` para Historial.
- `/reports` con subrutas gerenciales.
- `/backups`.
- `/settings/fiscal`.
- `/users` si el modulo existe.

## Sidebar

El sidebar debe priorizar tareas reales:

1. Inicio.
2. Nueva factura.
3. Caja.
4. Historial.
5. Catalogo.
6. Reportes.
7. Backups.
8. Configuracion fiscal.
9. Usuarios/roles si existe.

Cada item debe tener icono `lucide-react`, label claro y estado activo.

## Componentes base

- `AppShell`.
- `SidebarNav`.
- `Topbar`.
- `PageHeader`.
- `MetricCard`.
- `DataTable`.
- `FilterBar`.
- `ConfirmDialog`.
- `EmptyState`.
- `LoadingState`.
- `ErrorState`.
- `ReceiptPreview`.

## Reglas de implementacion futura

- No mezclar redisenos de todos los modulos en un solo commit.
- No ocultar funcionalidad existente mientras se migra.
- Mantener feature nueva apagada por defecto si implica riesgo.
- Usar allowlist por tenant si se introduce una variante riesgosa.
- Cada fase debe cerrar con smoke test de navegacion y flujo principal.
