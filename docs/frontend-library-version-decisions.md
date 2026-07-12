# Decisiones de Versiones de Librerías — S_Hospital

Este documento registra el análisis de compatibilidad, la evaluación de versiones y las decisiones técnicas sobre las dependencias que serán instaladas para el refactor total de la interfaz.

---

## 1. Ant Design (v6.x)
* **Versión Evaluada:** `6.5.0`
* **Versión Seleccionada:** `6.3.2` (Exacta)
* **Compatibilidad:** 100% compatible con **React 19.0.0**, **TypeScript 5.x** y **Vite 8.0.16**. Es la primera versión mayor de Ant Design que introduce soporte nativo completo para React 19 sin requerir parches de tipos.
* **Breaking Changes desde v5:**
  * Remoción completa de tokens obsoletos e inconsistencias de animaciones.
  * Cambios menores en la API de inputs y selectores (controlados mediante wrappers locales).
* **Razón de Elección:** Suite visual dominante que unifica inputs, botones, menús, alertas, modales y layouts en un único framework con esquinas rectas (`borderRadius: 0`).
* **Licencia:** MIT (Totalmente libre para producción local sin internet).
* **Impacto Estimado en Bundle:** ~80 KB (gzip) iniciales. Reducido gracias a la carga modular y tree-shaking de Vite 8.

---

## 2. Ant Design Icons (v5.x)
* **Versión Evaluada:** `5.6.0`
* **Versión Seleccionada:** `5.5.2` (Exacta)
* **Compatibilidad:** Compatible con React 19.
* **Breaking Changes:** Ninguno relevante.
* **Razón de Elección:** Única familia de iconos para toda la aplicación, reduciendo el bundle al eliminar Lucide React.
* **Licencia:** MIT.
* **Impacto en Bundle:** ~15 KB (gzip).

---

## 3. AG Grid Community (v33.x)
* **Versión Evaluada:** `33.0.4`
* **Versión Seleccionada:** `33.0.4` (Exacta)
* **Compatibilidad:** Compatible con React 19.
* **Breaking Changes:**
  * Uso obligatorio de la moderna `Theming API` basada en CSS variables estructuradas. Queda descontinuado el uso de clases legacy como `ag-theme-alpine` o `ag-theme-balham`.
* **Razón de Elección:** Es la última versión estable que ofrece alto rendimiento, traducción nativa completa y soporte accesible de teclado para grids densos sin dependencias Enterprise.
* **Licencia:** MIT (Versión Community libre para producción local).
* **Impacto Estimado en Bundle:** ~110 KB (gzip) iniciales, segregados en un chunk dinámico en Vite (`manualChunks`).

---

## 4. Apache ECharts (v5.x)
* **Versión Evaluada:** `5.6.0`
* **Versión Seleccionada:** `5.6.0` (Exacta)
* **Compatibilidad:** 100% compatible con React 19 como librería JS de manipulación directa del DOM.
* **Breaking Changes:** Ninguno respecto a la versión menor anterior.
* **Razón de Elección:** Motor de gráficos vectorial de alto rendimiento, compatible con el tema del hospital y accesible vía `AriaComponent` (imprescindible para cumplimiento WCAG 2.2 AA).
* **Licencia:** Apache 2.0.
* **Impacto Estimado en Bundle:** ~130 KB (gzip). Se importará modularmente (tree-shaking) y se cargará bajo demanda mediante lazy loading en el panel de reportes.
