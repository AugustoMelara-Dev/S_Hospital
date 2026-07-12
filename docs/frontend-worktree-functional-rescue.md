# Manifiesto de Rescate Funcional del Worktree — S_Hospital

Este documento detalla la clasificación de los cambios presentes en el worktree sucio antes de iniciar la refactorización visual, garantizando la preservación total de la lógica de negocio, seguridad, impresión y corrección de errores (hotfixes).

---

## 1. Clasificación de Cambios del Worktree

Hemos analizado las modificaciones pendientes en el worktree y las clasificamos en las siguientes categorías:

### A. Cambios Visuales Descartables (Eliminación Segura)
Son modificaciones estilísticas locales que introducían clases de bordes redondeados (`rounded-xl`), sombras decorativas, animaciones no requeridas y selectores CSS personalizados fuera de los tokens.
* **Archivos Afectados:** Componentes en `src/components/ui/` (como card, dialog, input, switch, badge).
* **Acción:** Serán completamente descartados al reconstruir los componentes visuales con Ant Design (borderRadius = 0).

### B. Cambios Funcionales y de Lógica de Negocio (Rescate Obligatorio)
Estas modificaciones son las reglas críticas de facturación, prevención de doble envío, mitigación de fallos en LAN offline, idempotencia y eritropoyetina gratis.
* **Regla de Eritropoyetina Gratis para Pacientes en Diálisis:**
  * *Ubicación original:* `src/features/catalog/components/ServiceSheet.tsx` (líneas 310-325) y `src/features/invoices/components/PaymentModal.tsx` (manejo de diálisis).
  * *Contrato:* El parámetro `is_dialysis` debe enviarse a nivel de factura al API de Laravel. Si es verdadero, el costo del servicio de eritropoyetina (L.25.00) se reduce a L.0.00 en el backend; el frontend debe validar y aplicar este descuento en la previsualización del carrito.
  * *Test Protector:* `src/features/invoices/NewInvoiceView.test.tsx` ("sends dialysis prescription only as an invoice-level flag").
  * *Fase de Traslado:* Fase 9.
* **Prevención de Doble Envío e Idempotencia:**
  * *Ubicación original:* `src/features/invoices/components/InvoiceConfirmation.tsx` (deshabilitar botón durante el envío de facturación) e `InvoiceHistoryView.tsx` (anulación con clave de idempotencia).
  * *Contrato:* El botón de confirmar venta debe desactivarse inmediatamente al hacer clic, y toda petición POST de cobro, reverso o anulación debe inyectar un encabezado o propiedad `idempotency_key` única.
  * *Test Protector:* `src/features/invoices/NewInvoiceView.test.tsx` ("does not call emit twice when Emit button is double-clicked", "does not create duplicate invoices when the final confirmation is double-clicked").
  * *Fase de Traslado:* Fase 9 y Fase 13.
* **Preservación del Carrito tras Error 422:**
  * *Ubicación original:* `src/features/invoices/NewInvoiceView.tsx`.
  * *Contrato:* Si el backend Laravel retorna un error de validación 422 (p. ej. CAI vencido o falta de correlativo en caja), el carrito de compras no debe vaciarse. El usuario debe poder corregir el dato o reintentar sin perder los servicios agregados.
  * *Test Protector:* `src/features/invoices/NewInvoiceView.test.tsx` ("preserves the cart after a 422 error from the backend").
  * *Fase de Traslado:* Fase 9.
* **Saneamiento del Nombre del Paciente:**
  * *Ubicación original:* `src/features/invoices/components/PatientStep.tsx`.
  * *Contrato:* El nombre del paciente ingresado debe limpiarse de espacios en blanco al inicio y al final (trim) antes de enviarse al API.
  * *Test Protector:* `src/features/invoices/NewInvoiceView.test.tsx` ("trims patient name before creating the invoice").
  * *Fase de Traslado:* Fase 9.

### C. Cambios de Seguridad, Permisos y Sesión (Rescate Obligatorio)
Control de acceso estricto a las vistas operativas y de administración según los permisos del rol.
* **Filtros de Visibilidad en Menú y Rutas:**
  * *Ubicación original:* `src/navigation/appNavigation.ts` y `src/AppRoutes.tsx`.
  * *Contrato:* Validación estricta usando `PermissionGate` y el helper `canAccessRoute` para bloquear rutas no autorizadas (p. ej. Configuración Fiscal o Respaldos).
  * *Test Protector:* `src/features/admin/UsersView.test.tsx`, `AppRoutes.lazy.test.ts`.
  * *Fase de Traslado:* Fase 5 y Fase 6.
* **Exclusión de Roles Admin Críticos:**
  * *Ubicación original:* `src/features/admin/components/PermissionMatrix.tsx` y `RoleFormDialog.tsx`.
  * *Contrato:* Validación estricta que impide que un administrador se quite a sí mismo el rol de superusuario o desactive permisos críticos de seguridad.
  * *Test Protector:* `src/features/admin/UsersView.test.tsx` ("allows self identity edits without sending role or permission changes").
  * *Fase de Traslado:* Fase 15.

### D. Cambios de Impresión (Rescate Obligatorio)
Lógica del subsistema de recibos institucionales que simula los tamaños en pantalla e imprime sin controles de interfaz.
* **Formatos de Lienzo Físico:**
  * *Ubicación original:* `src/features/receipt-settings/components/ReceiptSettingsPreview.tsx`.
  * *Contrato:* Dimensionar el contenedor visual emulando Carta, Media Carta, A5 y Tickets (80mm/58mm) sin sombras flotantes.
  * *Test Protector:* `src/features/receipts/ReceiptPreview.test.tsx`, `ReceiptPreview.a11y.test.tsx`.
  * *Fase de Traslado:* Fase 12.

---

## 2. Matriz de Rescate y Trazabilidad

| Flujo / Cambio Funcional | Archivo Destino | Test Protector | Fase de Refactor | Estado |
| :--- | :--- | :--- | :---: | :---: |
| Regla de Eritropoyetina | `src/features/invoices/NewInvoiceView.tsx` | `NewInvoiceView.test.tsx` | Fase 9 | Pendiente |
| Prevención Doble Envío | `src/features/invoices/components/InvoiceConfirmation.tsx` | `NewInvoiceView.test.tsx` | Fase 9 | Pendiente |
| Conservación de Carrito 422 | `src/features/invoices/NewInvoiceView.tsx` | `NewInvoiceView.test.tsx` | Fase 9 | Pendiente |
| Saneamiento Nombre Paciente | `src/features/invoices/components/PatientStep.tsx` | `NewInvoiceView.test.tsx` | Fase 9 | Pendiente |
| Edición Auto-Identidad | `src/features/admin/components/UsersTable.tsx` | `UsersView.test.tsx` | Fase 15 | Pendiente |
| Previsualización de Recibos | `src/printing/components/PrintPreviewFrame.tsx` | `ReceiptPreview.test.tsx` | Fase 12 | Pendiente |
