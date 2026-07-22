# Hallazgos Visuales y Rediseño de UI/UX - 03 Visual Findings

- **Sistema**: S_Hospital
- **Fecha**: 2026-07-22

## Resumen de Hallazgos Visuales y Soluciones Aplicadas

### 1. Inconsistencia de Estado de Caja en Topbar vs Pantalla
- **Síntoma**: El Topbar indicaba "Caja cerrada" mientras la pantalla de Caja indicaba "Caja abierta".
- **Causa Raíz**: Desincronización de claves en la caché de TanStack Query (`['cash-sessions', 'current', 'own']` vs `['cash-sessions', 'current', 'closable']`).
- **Solución**: Se actualizan ambas claves de caché de forma sincrónica en los hooks y mutaciones (`CashBoxView.tsx` y `useCashSession.ts`).

### 2. Selección Múltiple en Menú Lateral
- **Síntoma**: Rutas donde "Nueva Factura" y "Caja" aparecían activas simultáneamente.
- **Causa Raíz**: Comparación imprecisa de prefijo de ruta en `getActiveNavigationItem`.
- **Solución**: Unificación de resolución de elemento activo exacto en la navegación global.

### 3. Deriva de Días en Reportes
- **Síntoma**: Muestra de periodos como `18.999999999988425 días`.
- **Causa Raíz**: Truncamiento de punto flotante en la resta de marcas de tiempo en Carbon / JavaScript sin redondeo exacto.
- **Solución**: Aplicación de `round()` en `ExecutiveReportService.php` (`inclusiveDays`) y `Math.round()` en `ReportsExecutive.tsx`.

### 4. Mensajes Contradictorios en Respaldos
- **Síntoma**: Estado de error continuo pese a existir un respaldo reciente exitoso.
- **Causa Raíz**: `operationalSummary` mantenía bandera de error si `last_failure_at` no era nulo, ignorando si `last_success_at` era más reciente.
- **Solución**: Actualización de la regla en `backupPresentation.ts` (`hasRecentUnresolvedFailure`) para validar si el fallo fue resuelto por un respaldo exitoso posterior.

### 5. Puntos de Lista Invisibles en Ayuda Institucional (`HelpView.tsx`)
- **Síntoma**: Los puntos de viñeta en las listas de verificación diaria aparecían como espacios en blanco.
- **Causa Raíz**: Elementos `<span>` con clase `bg-secondary` sin dimensiones explícitas (`width` / `height`).
- **Solución**: Reemplazo por viñetas estilizadas con `size-1.5 rounded-full bg-primary/40` para garantizar visibilidad clara y estética profesional.

### 6. Indicador de Estado de Caja en Barra Superior (`ContextBar.tsx`)
- **Síntoma**: El badge de estado de caja siempre mostraba estilo neutral (gris `secondary`), independientemente de si la caja estaba abierta o cerrada.
- **Causa Raíz**: Uso estático del atributo `variant="secondary"`.
- **Solución**: Dinamización del Badge utilizando verde sobrio (`bg-success/10 text-success-foreground border-success/20`) cuando la caja está abierta y gris cuando está cerrada.

### 7. Densidad de Navegación del Menú Lateral (`InstitutionalRail.tsx`)
- **Síntoma**: Los ítems de navegación en el riel lateral usaban el tamaño `lg`, generando una altura vertical excesiva e ineficiente.
- **Causa Raíz**: Propiedad `size="lg"` asignada por defecto a `SidebarMenuButton`.
- **Solución**: Ajuste a `size="default"` para una densidad visual sobria, moderna y optimizada para entornos operativos hospitalarios de uso continuo.

### 8. Vista previa de recibo colapsada (`ReceiptSettingsPreview.tsx`)
- **Síntoma**: El panel de papel y copias mostraba una línea casi vacía en media carta y A5 aunque el contenido existía en el DOM.
- **Causa raíz**: El contenedor intermedio no ocupaba el ancho disponible y su hijo absoluto no aportaba tamaño intrínseco, por lo que la hoja se reducía al ancho mínimo.
- **Solución**: El grupo de páginas usa `w-full min-w-0`; Vitest protege la estructura y Playwright exige contenido visible y una altura mayor a 250 px en media carta y A5.
