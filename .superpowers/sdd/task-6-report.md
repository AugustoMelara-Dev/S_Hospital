# Task 6 - Recibo institucional y selector de papel

## Estado

Implementado con TDD. La configuración normal permite seleccionar exclusivamente
Carta, Media carta o A5. Los formatos 80 mm y 58 mm se muestran como
compatibilidad secundaria informativa y no tienen radio, handler ni ruta de
guardado como perfil predeterminado.

Esta separación responde al contrato real del backend: los perfiles térmicos no
pueden guardarse como `is_global_default`. Se conservaron los literales canónicos
del API (`letter`, `half_letter`, `a5`) y no se introdujo un enum UI incompatible.

## RED / GREEN

- RED de ajustes: `npm run test -- InstitutionalReceiptSettingsView` falló porque
  no existía el grupo `Formatos institucionales`.
- RED de policy/helper: fallaron las expectativas de `PAPER_CHOICES`, grupos,
  proporciones y mapeos centralizados antes de implementar la policy.
- GREEN de policy/helper: 8/8 pruebas.
- RED de settings/preview: fallaron fieldsets, compatibilidad informativa,
  preview inline, copy automático, `aria-label` y proporción derivada.
- GREEN de settings/preview: 32/32 pruebas.
- RED de recibo real: fallaron el grupo de acciones de 44 px y la preservación
  del root térmico 58 mm / helper para recibos ya emitidos.
- GREEN de recibo real/helper: 17/17 pruebas.
- RED de corrección de review: 4 fallos esperados demostraron que Carta seguía
  vertical, no existía una fuente única para las cinco clases print y la
  superficie de preview no tenía estructura ni container queries de escala.
- GREEN de corrección: Carta horizontal, policy de las cinco clases y preview
  móvil escalable quedaron cubiertos por 29/29 pruebas focalizadas.
- RED del P1 final: 2 fallos demostraron que `min-h-full` seguía en el canvas y
  no existía un cálculo `contain` basado en las dimensiones reales de papel y
  contenido. El primer E2E real también expuso el bundle Docker sin recargar.
- GREEN del P1 final: el test de componente pasa 7/7 y el E2E real pasa 1/1
  contra frontend, backend y MariaDB del stack local.

## Formatos y policy

- `PAPER_CHOICES`: Carta, Media carta y A5; exactamente una vez cada uno.
- `THERMAL_COMPATIBILITY_CHOICES`: 80 mm y 58 mm; solo informativos.
- La policy centraliza etiqueta, descripción, proporción, clase de preview,
  clase print existente y mapeo al código de perfil backend.
- Carta deriva la proporción horizontal `11 / 8.5`, coherente con el perfil
  backend existente `carta_horizontal`.
- `receiptPaperPresentation` acepta los cinco literales de `ReceiptPaperSize`;
  `ReceiptPreview` consume su `printClass` y ya no compone clases localmente.
- Un valor térmico o inválido recibido como ajuste predeterminado normaliza a
  `half_letter`.
- Un recibo ya emitido con ancho 80/58 conserva ese ancho para impresión y su
  print root; esto no habilita guardarlo como default.

## Accesibilidad y responsive

- Radios HTML nativos dentro de `fieldset` / `legend`.
- Selección comunicada por `checked`, icono y texto `Seleccionado`.
- Targets mínimos de 44 px y foco visible.
- Estado solo lectura conserva radios deshabilitados y alerta de permiso.
- Preview junto a ajustes en escritorio y debajo en anchos menores.
- La hoja de preview es un size container con overflow controlado. Cada papel
  contiene un canvas lógico estable sin `min-h-full`; un observador mide ancho y
  alto reales del papel y el `scrollWidth`/`scrollHeight` del contenido para
  calcular `contain`. La escala se recalcula al cambiar tamaño o cargar fuentes.
- Las queries a 26 rem y 20 rem permanecen como fallback previo a la medición;
  la escala inline medida garantiza que tabla, firmas y footer no se recorten.
- Preview rotulado `Vista previa de recibo {papel}`, con paciente y datos de
  muestra realistas, sin QR, barcode, scan codes ni IDs internos.
- Las acciones del recibo real están agrupadas fuera de
  `data-receipt-print-root` y conservan la auditoría previa a imprimir.

## Selectores de impresión preservados

Se preservaron los roots y reglas existentes; la corrección de review cambió
exclusivamente la orientación y superficie de Carta para igualar
`carta_horizontal`:

- `receipt-letter`: `size: letter landscape`, `margin: 0.45in`, superficie
  coherente de `10.1in × 7.6in`.
- `receipt-half-letter`: `size: 8.5in 5.5in`, `margin: 0.35in`.
- `receipt-a5`: `size: A5 landscape`, `margin: 0.3in`.
- `receipt-80mm`: `size: 80mm auto`, `margin: 4mm`.
- `receipt-58mm`: `size: 58mm auto`, `margin: 3mm`.
- `data-receipt-print-root`, tablas semánticas, paciente y limpieza del estado
  `data-receipt-width` / `data-printing-receipt` permanecen cubiertos.

El cambio de CSS fuera de Carta se limita a la superficie de preview: canvas
lógico por proporción, container queries de fallback, escala con origen superior
izquierdo, wrap seguro y topes visuales por proporción.

## Gates

- Directed Vitest: PASS, 6 archivos / 59 pruebas.
- `npm run typecheck`: PASS.
- `npm run lint -- --quiet`: PASS.
- `git diff --check`: PASS.
- `npx playwright test e2e/clinical-receipts.spec.ts --list`: PASS, 1 prueba.
- E2E visual real contra Docker: PASS, 1/1 en Chromium (15.3 s).
- Autorrevisión de copy/DOM: no hay controles con labels de margen, escala,
  fuente, tamaño ni medidas. La única mención visible es el copy requerido que
  indica que el sistema ajusta esos parámetros automáticamente.

## E2E y preocupaciones

`clinical-receipts.spec.ts` reutiliza el patrón de login administrativo por
credenciales temporales de QA, verifica los tres radios/previews, genera una
captura por papel a 1366 px, comprueba ausencia de labels técnicos y valida a
320 px transformación distinta de `none`, contenido dentro del papel en ambos
ejes, tabla, firmas y footer dentro del papel, proporción, cero overflow y
screenshot móvil. No guarda ajustes, no crea datos y no imprime.

La ejecución real usó credenciales QA conocidas y el stack local Docker. Solo se
leyó la configuración institucional; los cambios de radio quedaron en estado
cliente y no se pulsó Guardar ni Imprimir.
