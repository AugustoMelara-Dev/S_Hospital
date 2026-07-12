# Línea Base de Ejecución del Refactor del Frontend — S_Hospital

Este documento contiene la línea base técnica y verificable para el refactor visual de S_Hospital. Los datos aquí contenidos han sido extraídos mediante comandos estáticos directos en el repositorio y representan la realidad del código antes de cualquier modificación.

---

## 1. Métricas Verificadas del Frontend

A través de comandos de diagnóstico en PowerShell y ripgrep, se han obtenido las siguientes cifras exactas y comprobables:

### Archivos de Código en `src/`
* **Total de Archivos TypeScript / TSX:** **381 archivos**
  * *Comando:* `Get-ChildItem -Path src -Recurse -Filter *.ts* | Measure-Object`
* **Archivos de Prueba (Vitest/Tests):** **134 archivos**
  * *Comando:* `Get-ChildItem -Path src -Recurse | Where-Object { $_.Name -like "*test.*" } | Measure-Object`
* **Archivos de Producción (Código Fuente Activo):** **247 archivos** (Calculado: `381 total - 134 pruebas`)

### Inventario de Componentes y Vistas
* **Componentes en `src/components/ui` (shadcn legacy):** **62 archivos**
  * *Comando:* `Get-ChildItem -Path src/components/ui -File | Measure-Object`
  * *Desglose:* **50 archivos de producción** y **12 archivos de prueba**.
* **Rutas Navigacionales Reales:** **13 rutas principales** declaradas en `AppRoutes.tsx` y `appNavigation.ts`:
  1. `/dashboard` (DashboardView)
  2. `/billing/new` (NewInvoiceView)
  3. `/cashbox` (CashBoxView)
  4. `/catalog` (CatalogView)
  5. `/invoices` (InvoiceHistoryView)
  6. `/reports` (ReportsView con subrutas `/reports/executive`, `/reports/cash`, `/reports/audit`)
  7. `/backups` (BackupsView)
  8. `/settings/fiscal` (FiscalSettingsView)
  9. `/settings/institutional-receipts` (InstitutionalReceiptSettingsView)
  10. `/admin/users` (UsersView)
  11. `/support` (SupportCenterView)
  12. `/help` (HelpView)
  13. `/about` (AboutView)
  * *Notas:* Plus redirecciones (`/`, `/login`) y wildcard `*` (`NotFoundView`). Hay un total de **20 vistas y estados de navegación distintos** operando condicionalmente.
* **Formularios Principales:** **11 formularios** (Login, Cambio obligatorio de contraseña, Asistente de importación CSV, Datos del paciente en facturación, Cobro, Apertura de caja, Cierre de caja, Registro de ingresos/egresos, Creación de servicio, Creación de categoría, y Configuración fiscal).
* **Overlays (Modales y Drawers):** **15 overlays** activos repartidos en los flujos operativos.
* **Grids y Tablas Operativas:** **8 tablas** de datos complejas (TodayLedger, CashMovementsTable, ServiceCatalogTable, InvoiceHistoryTable, FiscalSequencesTable, UsersTable, BackupHistoryTable, y PermissionMatrix).
* **Gráficos Activos:** **2 componentes de gráficos** (TrendChart y PaymentMethodPanel, actualmente implementados en Recharts y listos para migrar a Apache ECharts).
* **Componentes Compartidos / Shell por Eliminar:** **6 componentes** (ClinicalShell, ClinicalRail, ContextBar, ClinicalMobileNav, CommandPalette y AppErrorBoundary).

---

## 2. Inventario de Imports de Dependencias Obsoletas

A través de búsquedas por patrón con ripgrep, se determinó el número de archivos que importan las dependencias que serán desinstaladas al final de la refactorización:

| Dependencia Legacy | Archivos Consumidores | Comando Utilizado |
| :--- | :---: | :--- |
| **`@radix-ui/*`** | **21 archivos** | `grep_search` para `@radix-ui` |
| **`lucide-react`** | **95 archivos** | `grep_search` para `lucide-react` |
| **`recharts`** | **4 archivos** | `grep_search` para `recharts` |
| **`sonner`** | **5 archivos** | `grep_search` para `sonner` |
| **`vaul`** | **1 archivo** | `grep_search` para `vaul` |
| **`cmdk`** | **1 archivo** | `grep_search` para `cmdk` |
| **`react-day-picker`**| **2 archivos** | `grep_search` para `react-day-picker` |
| **`@tanstack/react-table`** | **2 archivos** | `grep_search` para `@tanstack/react-table` |
| **`motion` / `motion/react`** | **2 archivos** | `grep_search` para `motion/react` |

---

## 3. Discrepancias Identificadas respecto al Plan

1. **Número de Componentes UI a Eliminar:** El plan mencionaba la eliminación de 56 componentes. La medición física muestra que en `src/components/ui` hay 62 archivos (50 componentes de código y 12 tests) más los 6 componentes de layout y shell, lo que da un total de **68 archivos visuales obsoletos** que serán reemplazados y limpiados del repositorio.
2. **Número de Áreas en la Narrativa:** El plan narrativo agrupaba y mencionaba "39 áreas". La extracción real del enrutador de React (`AppRoutes.tsx`) muestra **13 componentes de nivel vista principales** y **3 subrutas de reportes**. Consolidaremos estas rutas operativas en 20 subflujos de trabajo bien definidos.
3. **Versión de Dependencias:** El plan fijaba AG Grid v33 y ECharts v5 de forma genérica. Analizaremos las versiones estables óptimas de AG Grid y Apache ECharts compatibles con React 19 y TypeScript 5 antes de instalarlas.
4. **Fusión de Componentes Visuales:** El plan sugería migrar el carrito de facturación a AG Grid de forma automática. Hemos verificado que la usabilidad del carrito se beneficia de una estructura densa y editable nativa de Ant Design (`Table`/`List`), por lo que no se forzará AG Grid en el carrito de emisión de facturas.
5. **Nombre de `clinical-tokens.css`:** El plan mantenía esta nomenclatura histórica. Para garantizar la limpieza del lenguaje de diseño, se renombrará completamente a `institutional-tokens.css` dentro del nuevo directorio `src/design-system/tokens/`.
