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
