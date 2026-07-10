# Task 5 — Estación de facturación, cobro y resultado

## Estado

Completado y verificado. La estación de facturación conserva reducer, payload,
contratos API y helpers monetarios existentes.

Commit previsto: `feat(billing): redesign invoice workstation and payment flow`.

## Archivos

- `frontend/src/features/invoices/NewInvoiceView.test.tsx`
- `frontend/src/features/invoices/components/NewInvoiceViewLayout.tsx`
- `frontend/src/features/invoices/components/NewInvoiceViewLayout.test.tsx`
- `frontend/src/features/invoices/components/PatientStep.tsx`
- `frontend/src/features/invoices/components/PatientStep.test.tsx`
- `frontend/src/features/invoices/components/ServiceSearch.tsx`
- `frontend/src/features/invoices/components/ServiceSearch.test.tsx`
- `frontend/src/features/invoices/components/InvoiceCart.tsx`
- `frontend/src/features/invoices/components/InvoiceCart.test.tsx`
- `frontend/src/features/invoices/components/PaymentModal.tsx`
- `frontend/src/features/invoices/components/PaymentModal.test.tsx`
- `frontend/src/features/invoices/components/InvoiceConfirmation.tsx`
- `frontend/src/features/invoices/components/InvoiceConfirmation.test.tsx`
- `frontend/src/features/invoices/components/InvoiceSuccess.tsx`
- `frontend/src/features/invoices/components/InvoiceSuccess.test.tsx`

## Evidencia RED / GREEN

### Layout y navegación móvil

- RED: 4 fallos esperados por regiones semánticas, workspace de tres zonas y
  navegación móvil ausentes; 3 pruebas heredadas seguían verdes.
- GREEN: 8/8 entre `NewInvoiceViewLayout.test.tsx` y la prueba axe.
- Se mantienen montadas las tres regiones y el foco cambia con el paso móvil.

### Paciente

- RED: 2 fallos esperados por disclosure opcional y resumen de error no enfocable.
- GREEN: 6/6.
- Solo el nombre sigue siendo obligatorio; no se agregaron datos clínicos.

### Servicios

- RED: 3 fallos esperados por Enter duplicado, fila operativa/target explícito y
  estado de error no diferenciado.
- GREEN: 12/12.
- `useDeferredValue` afecta únicamente el filtrado visual; no cambia query keys ni API.

### Cuenta actual

- RED: 3 fallos esperados por encabezado/contador, targets de 44 px y receta EPO
  visible sin permiso.
- GREEN: 11/11.
- Microciclo adicional: RED por total duplicado en un `actionLabel` que ya lo
  contenía; GREEN 18/18 junto con layout.

### Pago

- RED: 5 fallos esperados por radios ausentes, referencia mostrada para `other`,
  CTA sin total/target y doble clic sin bloqueo local.
- GREEN: 28/28.
- Se conserva `onConfirm(appliedAmount)` y las validaciones de monto, cambio,
  referencia y pago parcial.

### Confirmación y resultado

- RED: 3 fallos esperados por lenguaje técnico, resultado pagado incompleto y
  factura emitida sin lenguaje pendiente.
- GREEN: 19/19 junto con layout y axe.
- El resultado muestra número, paciente, total, método/fecha cuando existen y
  solo ofrece acciones con handler o enlace real.

### Integración

- `InstitutionalReceiptFlow.test.tsx`: verde sin cambios de comportamiento.
- `NewInvoiceView.test.tsx`: primera mitad 13/13; cuatro casos visuales exactos
  4/4 tras actualizar selectores a los nuevos labels/filas.
- Gate dirigido final: 11 archivos, 105/105 pruebas verdes.

## Gate final

- `npm run test -- NewInvoiceView NewInvoiceViewLayout PatientStep ServiceSearch InvoiceCart PaymentModal InvoiceConfirmation InvoiceSuccess InstitutionalReceiptFlow --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` — 105/105.
- `npm run typecheck` — exit 0.
- `npm run lint -- --quiet` — exit 0, sin warnings.
- `git diff --check` — exit 0.

## Autorrevisión

- No hay cambios en `state/**`, `invoicePayload.ts`, API contracts ni money helpers.
- Un solo CTA dominante en la cuenta; total visible y sin duplicación.
- No se agregaron botones sin handler ni enlaces sin destino.
- Grid `xl` de tres zonas, tablet de dos columnas y secuencia móvil con borrador
  preservado; ticket sticky solo en `xl` con scroll interno.
- Targets operativos principales de al menos 44 px y reduced motion en pasos/resultado.
- EPO conserva L 25.00 y la receta autorizada controla L 0.00 mediante el flujo existente.
- Facturación, pagos, idempotencia, recibo institucional y recuperación siguen
  cubiertos por las pruebas de integración.
- Sin strings corruptas nuevas, warnings React/ARIA ni términos técnicos visibles.

## Preocupaciones

- La validación responsive fue estructural/clases y axe, conforme a la restricción
  de no ejecutar navegador en esta tarea.

## Correcciones de revisión

Se corrigieron todos los hallazgos posteriores sobre el commit original
`f47c73ae2095762c9356d59d3b7e991b68180f68` mediante nuevos ciclos RED/GREEN:

- **Bloqueo de lector/búsqueda:** RED confirmó que Enter seguido de clic ejecutaba
  dos búsquedas. GREEN usa locks síncronos independientes, espera operaciones
  asíncronas, limpia timers y permite un reintento posterior. `ServiceSearch`:
  13/13.
- **Guardar PDF separado:** RED confirmó cero descargas porque Guardar reutilizaba
  Imprimir. GREEN agrega un handler que obtiene y descarga el blob sin registrar
  evento de impresión; Imprimir conserva auditoría y apertura. Flujo exacto: 1/1.
- **Métodos de pago:** RED confirmó ausencia de roving tab index/navegación y
  referencia residual. GREEN agrega ArrowLeft/Right/Up/Down, Home/End, foco,
  seguridad durante `submitting` y limpieza para efectivo/otro. `PaymentModal`:
  31/31.
- **Referencia residual en integración:** transferencia con referencia seguida de
  efectivo envía `method: cash` y `reference: null`. Flujo exacto: 1/1.
- **Metadatos de abono:** RED confirmó que parcial/emitida ocultaban método y fecha.
  Una integración final confirmó además que `registerPayment` entrega `payment`
  separado y que `invoice` puede omitir `payments`. GREEN conserva el pago actual
  en un ref, lo prioriza para método/fecha y lo limpia al emitir/resetear, sin tocar
  reducer ni contratos API. Los flujos real pagado/parcial pasaron 2/2 y el reset
  no filtra el metadato al siguiente borrador.
- **Targets y foco:** RED confirmó controles de 40 px, acciones nuevas de 40 px y
  regiones enfocables sin ring. GREEN mantiene 44 px en lector/filtros/acciones y
  anillo visible en las tres regiones; conjunto con axe: 30/30.
- **Recuperación de recibo:** RED confirmó el mismo mensaje dos veces. GREEN deja
  el detalle una sola vez en el cuerpo y una descripción breve en el diálogo.
- **Guard arquitectónico:** la primera corrida señaló 711 líneas frente al máximo
  710; se compactó una línea sin cambiar comportamiento y la prueba exacta pasó.

### Gate final posterior a revisión

- Gate dirigido: 11 archivos, 111/111 pruebas verdes.
- `npm run typecheck`: exit 0.
- `npm run lint -- --quiet`: exit 0.
- `git diff --check`: exit 0.
- Sin suite total ni navegador, conforme a las restricciones de la tarea.

## QA visual PatientStep

La revisión visual posterior detectó que el grid interno respondía al viewport y
comprimía el campo dentro de la columna estrecha de escritorio.

- RED: `PatientStep.test.tsx` confirmó la presencia de `md:grid-cols` y que el
  bloque de conteo no ocupaba el ancho completo; 6 pruebas heredadas pasaron.
- GREEN: el campo y el conteo usan un stack vertical permanente, ambos a ancho
  completo, sin modificar handlers, validación ni foco de errores. `PatientStep`:
  7/7.
- Strings visibles verificados en UTF-8: `Ej. Maria Lopez…` y la explicación de
  que no se necesita expediente clínico.
- Integración dirigida `PatientStep` + layout + axe: 15/15.
- Gate completo dirigido de facturación: 11 archivos, 112/112 pruebas.
- `npm run typecheck`, `npm run lint -- --quiet` y `git diff --check`: exit 0.
