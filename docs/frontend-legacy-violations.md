# Reporte de Violaciones Legacy del Frontend — S_Hospital

> Recuento verificado el 2026-07-13: `npm run check:ui-legacy` continúa fallando
> con **165 violaciones en 407 archivos**. Facturación aporta **0 imports legacy**
> y **0 clases prohibidas** después de eliminar su último `rounded-md`. El gate
> transversal no está certificado.

Este reporte agrupa las **165 violaciones de la UI antigua** (imports prohibidos y clases Tailwind decorativas obsoletas) detectadas en los 407 archivos escaneados del código fuente de `frontend/src/`.

---

## 1. Resumen de Violaciones y Backlog

* **Total de Archivos Auditados:** 407
* **Total de Violaciones Reportadas:** 165
  * **Clases Prohibidas (`rounded-*`, `shadow-*`, `bg-gradient-*`):** 124
  * **Imports Legacy (`lucide-react`, `@radix-ui/`, `sonner`, etc.):** 41

---

## 2. Reporte Agrupado por Módulo

### Primitivos de Componentes ShadCN (`src/components/ui/`)
Estos archivos representan las primitivas legacy del sistema antiguo. Están marcadas como `exempted` temporalmente por el scanner hasta que sean completamente eliminadas tras migrar a sus equivalentes de Ant Design.

| Archivo | Tipo de Violación | Detalles |
| :--- | :--- | :--- |
| `src/components/ui/accordion.tsx` | Import Prohibido | `@radix-ui/react-accordion`, `lucide-react` |
| `src/components/ui/action-menu.tsx` | Import / Clase | `lucide-react` / `shadow-sm` |
| `src/components/ui/alert-dialog.tsx` | Import Prohibido | `@radix-ui/react-alert-dialog` |
| `src/components/ui/alert.tsx` | Import Prohibido | `lucide-react` |
| `src/components/ui/animations.tsx` | Import / Clase | `motion/react` / `rounded-2xl`, `shadow-sm`, `rounded-md` |
| `src/components/ui/audit-log-list.tsx` | Clases Prohibidas | `rounded-xl`, `rounded-full`, `shadow-sm`, `rounded-md` |
| `src/components/ui/breadcrumb.tsx` | Import Prohibido | `@radix-ui/react-slot`, `lucide-react` |
| `src/components/ui/button.tsx` | Import Prohibido | `@radix-ui/react-slot` |
| `src/components/ui/calendar.tsx` | Import Prohibido | `lucide-react`, `react-day-picker` |
| `src/components/ui/chart.tsx` | Import Prohibido | `recharts` |
| `src/components/ui/checkbox.tsx` | Import Prohibido | `@radix-ui/react-checkbox`, `lucide-react` |
| `src/components/ui/collapsible.tsx` | Import Prohibido | `@radix-ui/react-collapsible` |
| `src/components/ui/command.tsx` | Import Prohibido | `cmdk`, `lucide-react` |
| `src/components/ui/confirm-dialog.tsx` | Import / Clase | `@radix-ui/react-alert-dialog`, `lucide-react` / `rounded-2xl`, `rounded-xl` |
| `src/components/ui/data-table.tsx` | Import Prohibido | `@tanstack/react-table`, `lucide-react` |
| `src/components/ui/date-range-picker.tsx`| Import Prohibido | `lucide-react`, `react-day-picker` |
| `src/components/ui/dialog.tsx` | Import Prohibido | `@radix-ui/react-dialog`, `lucide-react` |
| `src/components/ui/drawer.tsx` | Import Prohibido | `vaul` |
| `src/components/ui/dropdown-menu.tsx` | Import Prohibido | `@radix-ui/react-dropdown-menu` |
| `src/components/ui/filter-bar.tsx` | Import / Clase | `lucide-react` / `rounded-lg`, `rounded-md`, `shadow-sm`, `rounded-xl` |
| `src/components/ui/metric-card.tsx` | Import Prohibido | `lucide-react` |
| `src/components/ui/pagination.tsx` | Import Prohibido | `lucide-react` |
| `src/components/ui/popover.tsx` | Import Prohibido | `@radix-ui/react-popover` |
| `src/components/ui/progress.tsx` | Import Prohibido | `@radix-ui/react-progress` |
| `src/components/ui/radio-group.tsx` | Import Prohibido | `@radix-ui/react-radio-group`, `lucide-react` |
| `src/components/ui/scroll-area.tsx` | Import Prohibido | `@radix-ui/react-scroll-area` |
| `src/components/ui/search-input.tsx` | Import / Clase | `lucide-react` / `rounded-xl`, `shadow-sm`, `rounded-lg` |
| `src/components/ui/select.tsx` | Import Prohibido | `@radix-ui/react-select`, `lucide-react` |
| `src/components/ui/separator.tsx` | Import Prohibido | `@radix-ui/react-separator` |
| `src/components/ui/sheet.tsx` | Import Prohibido | `@radix-ui/react-dialog`, `lucide-react` |
| `src/components/ui/sonner.tsx` | Import Prohibido | `sonner` |
| `src/components/ui/spinner.tsx` | Import Prohibido | `lucide-react` |
| `src/components/ui/states.tsx` | Import Prohibido | `lucide-react` |
| `src/components/ui/status-badge.tsx` | Import Prohibido | `lucide-react` |
| `src/components/ui/switch.tsx` | Import Prohibido | `@radix-ui/react-switch` |
| `src/components/ui/tabs.tsx` | Import Prohibido | `@radix-ui/react-tabs` |
| `src/components/ui/tooltip.tsx` | Import Prohibido | `@radix-ui/react-tooltip` |

---

### Módulos Funcionales Activos
Consumidores que importan componentes antiguos o usan estilos no conformes directos. Se deben migrar por completo a Ant Design en sus respectivas fases.

#### 1. Módulo de Recibos y Configuración (`src/features/receipt-settings/`)
* **Archivos:**
  * `InstitutionalReceiptSettingsView.tsx` (Línea 4: import lucide-react; 359: rounded-xl; 541: rounded-md; 699: rounded-md)
  * `components/ReceiptSettingsPreview.tsx` (Línea 80: rounded-2xl; 87: rounded-sm)
* **Acción:** Reemplazar Lucide con Ant Design Icons y remover clases de bordes/sombras.

#### 2. Módulo de Vista de Recibos (`src/features/receipts/`)
* **Archivo:** `ReceiptPreview.tsx` (Línea 4: import alert; 5: import badge; 6: import button; 65: rounded-xl; 65: shadow-sm)
* **Acción:** Reemplazar completamente con Ant Design components.

#### 3. Módulo de Onboarding (`src/features/onboarding/`)
* **Archivo:** `GuidedTour.tsx` (Línea 1: import lucide-react; 80: rounded-2xl; 82: rounded-xl; 82: shadow-md; 98: rounded-xl)
* **Acción:** Reemplazar con Ant Design `Tour` oficial.

#### 4. Módulo de Diseño Global / Layout (`src/layout/components/`)
* **Archivos:**
  * `OperationalStatus.tsx` (Línea 1: import lucide-react; 27: shadow-sm; 32, 46, 56: rounded-md)
  * `SidebarNavItem.tsx` (Línea 27: rounded-md; 32: shadow-sm; 42, 53: rounded-full)
* **Acción:** Migrar a componentes de Ant Design.

#### 5. Módulo de Contabilidad (`src/modules/accounting/`)
* **Archivo:** `components/AccountingControlPanel.tsx` (Línea 38: rounded-2xl)
* **Acción:** Remover clases redondeadas.

#### 6. Módulo de Políticas e Informes de Contabilidad (`src/modules/reports/`)
* **Archivo:** `components/AccountingPolicyPanel.tsx` (Línea 1: import lucide-react; 23, 57: rounded-xl)
* **Acción:** Reemplazar con Card y elementos planos Ant Design.

---

## 3. Plan de Eliminación de Primitivas ShadCN

Las primitivas ShadCN se eliminarán del proyecto en las siguientes fases del refactor:

| Fase | Primitivos ShadCN a Eliminar |
| :--- | :--- |
| **Fase 9 (Catálogo)** | `dialog.tsx`, `sheet.tsx`, `form-field.tsx`, `form-section.tsx`, `input.tsx` |
| **Fase 10 (Facturación)** | `data-table.tsx`, `select.tsx`, `alert-dialog.tsx`, `dropdown-menu.tsx`, `badge.tsx` |
| **Fase 11 (Reportes)** | `chart.tsx`, `popover.tsx`, `tabs.tsx` |
| **Fase 12 (Configuración/Admin)** | `calendar.tsx`, `date-range-picker.tsx`, `switch.tsx`, `textarea.tsx`, `accordion.tsx` |
| **Fase Transversal Final** | `sonner.tsx`, `spinner.tsx`, `states.tsx`, `status-badge.tsx`, `status-tag.tsx` |
