# Checklist de Accesibilidad — `docs/accessibility-checklist.md`

> Lista de verificación WCAG 2 AA aplicada al sistema S_Hospital tras el refactor integral.

## 1. Reglas generales (AA)

- [x] **1.1.1 Texto alternativo**: todos los iconos decorativos tienen `aria-hidden="true"`; los iconos accionables tienen `aria-label`.
- [x] **1.3.1 Información y relaciones**: los headings (`h1`/`h2`/...) están en orden secuencial y semánticamente correctos. Cada pantalla tiene un único `h1`.
- [x] **1.4.3 Contraste mínimo (AA)**: paleta `styles.css` con tokens `--color-*` cumple ratio >= 4.5:1 en texto principal, >= 3:1 en iconos/interactivos grandes.
- [x] **1.4.11 Contraste no textual (AA)**: bordes y focus rings usan `--color-ring` y `--color-destructive` auditados.
- [x] **2.1.1 Teclado**: todas las acciones críticas son operables por teclado (`Tab`, `Enter`, `Esc`, `Ctrl+Enter` para emitir factura).
- [x] **2.4.7 Foco visible**: `focus-visible:ring-2 focus-visible:ring-ring` global en `styles.css`.
- [x] **3.3.1 Identificación de errores**: cada campo de formulario usa `aria-invalid` + `<p role="alert" id="...">` cuando hay error.
- [x] **4.1.2 Nombre, rol, valor**: todos los botones tienen texto o `aria-label`. Iconos decorativos sin label no aparecen como controles.
- [x] **4.1.3 Mensajes de estado**: regiones `role="status"` y `aria-live="polite"` consolidadas (no spinners decorativos duplicados).

## 2. Específicos del sistema

### Navegación
- [x] Skip-link en `AppShell.tsx` apuntando a `#main-content`.
- [x] `<aside id="app-sidebar" aria-label="Navegacion principal">`.
- [x] `aria-expanded` + `aria-controls="app-sidebar"` en botón de toggle.
- [x] Cada item del sidebar tiene `aria-current="page"` cuando está activo.

### Formularios
- [x] Cada input tiene `<Label>` asociado vía `htmlFor`.
- [x] Cada input tiene `aria-describedby` apuntando a hint y/o error.
- [x] Errors se anuncian con `role="alert"`.

### Modales
- [x] Radix Dialog/AlertDialog provee focus trap y restauración.
- [x] Cierre con `Esc` no destructivo.
- [x] `aria-label` o `aria-labelledby` en el diálogo.

### Datos
- [x] Las `DataTable` tienen `caption` y `containerLabel` accesible.
- [x] Headers de tabla semánticamente correctos (`<th scope="col">`).
- [x] Celdas numéricas con `data-numeric="true"`.

### Gráficos
- [x] `TrendChart` con tabla `sr-only` alternativa para lectores de pantalla.
- [x] `aria-label` en contenedor de chart.

### Navegación por teclado (flujos críticos verificados)

- [x] **Factura**: Tab desde paciente → Enter → Tab a servicio → Enter → Ctrl+Enter emite.
- [x] **Caja**: Tab a "Cerrar caja" → modal → Tab a input contado → input motivo → botón confirmar habilitado.
- [x] **Reimprimir historial**: Botón con motivo obligatorio, ≥ 5 caracteres.
- [x] **Sidebar collapse**: aria-pressed + aria-expanded correctos.

## 3. Tests automatizados

- `e2e/v1-2-visible-ui-a11y.spec.ts` corre axe-core en 6 resoluciones con WCAG 2 A + AA.
- `e2e/refactor-total.spec.ts` corre smoke tests por pantalla.

## 4. Pendientes (no críticos)

- Auditar detalles de focus en Tabs Content de settings (los headers Radix ya son accesibles).

