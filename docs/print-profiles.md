# Perfiles de impresión institucional — `docs/print-profiles.md`

> Especificación cerrada de los perfiles que el hospital puede elegir. Todos los tamaños, márgenes, tipografía y CSS de impresión son fijos; la UI normal no los expone.

## 1. Principio

> El hospital elige el papel. El sistema resuelve márgenes, layout y CSS de impresión.

El operador solo elige entre 5 perfiles pre-definidos. Los márgenes, tamaño, fuente y escala se calculan automáticamente desde el perfil. Los inputs manuales antiguos (ancho mm, alto mm, márgenes, fuente, escala) están **completamente fuera** del flujo normal y viven detrás de un modo soporte técnico que requiere el permiso explícito `receipt_settings.advanced`.

## 2. Perfiles cerrados

| Código | Etiqueta pública | Page size | Orientación | Margen físico | tipografía base | copias | uso |
|---|---|---|---|---|---|---|---|
| `carta` | Carta | US Letter 8.5 × 11 in | portrait | 0.45 in | Times New Roman / Georgia, 12 px | 1, 2, 3 | Impresión formal estándar |
| `media_carta` | Media carta | 8.5 × 5.5 in | landscape | 0.35 in | Times New Roman / Georgia, 12 px | 1, 2, 3 | Recomendado por defecto |
| `a5` | A5 | A5 148 × 210 mm | landscape | 0.30 in (≈ 7.6 mm) | Times New Roman / Georgia, 11 px | 1, 2, 3 | Folleto institucional |
| `80mm` | Ticket 80 mm | 80 mm auto | n/a | 4 mm | SFMono / Cascadia Mono, 10 px | 1, 2 | Impresora térmica |
| `58mm` | Ticket 58 mm | 58 mm auto | n/a | 3 mm | SFMono / Cascadia Mono, 9 px | 1, 2 | Impresora térmica compacta |

Las tres primeras son **perfiles institucionales formales** (recomendadas para PDF/impresión legal). Las térmicas son **compatibilidad secundaria** (admiten sólo originales + 1 copia; no admiten ser el predeterminado global).

## 3. CSS de impresión (inmutable, vive en `styles.css`)

```css
@media print {
  @page receipt-carta       { size: letter;       margin: 0.45in; }
  @page receipt-media-carta { size: 8.5in 5.5in;  margin: 0.35in; }
  @page receipt-a5          { size: A5 landscape; margin: 0.30in; }
  @page receipt-80mm        { size: 80mm auto;    margin: 4mm; }
  @page receipt-58mm        { size: 58mm auto;    margin: 3mm; }

  body[data-printing-receipt="true"] [data-receipt-print-root] {
    position: absolute; inset: 0 auto auto 0; width: 100%; box-shadow: none;
  }
  body[data-printing-receipt="true"] * { visibility: hidden !important; }
  body[data-printing-receipt="true"] [data-receipt-print-root],
  body[data-printing-receipt="true"] [data-receipt-print-root] * {
    visibility: visible !important;
  }

  .institutional-receipt          { background: #fff !important; color: #111827 !important; }
  .receipt-preview-controls,
  .no-print                       { display: none !important; }
  .receipt-preview-container      { border: 0 !important; background: #fff !important; padding: 0 !important; }

  .receipt-items-table tr,
  .receipt-totals-table tr        { break-inside: avoid; page-break-inside: avoid; }
}
```

## 4. Garantías del layout

- Sin cortes de filas de servicio ni de totales (`break-inside: avoid`).
- Firma y sello no quedan en la última línea cortada (espacio reservado arriba del footer).
- No imprime sidebar, header, ni dock flotante (`visibility: hidden` global durante el `body[data-printing-receipt="true"]`).
- Sin shadow en impresión (`box-shadow: none`).
- No depende del zoom del navegador (las dimensiones `@page` controlan el layout final).

## 5. Watermark de prueba

Cuando el operador pulsa **Imprimir prueba**, el PDF de respuesta lleva:

- Cabecera `X-Receipt-Test-Print: PRUEBA - SIN VALIDEZ`.
- Marca visible **PRUEBA - SIN VALIDEZ** en el cuerpo del documento (configurada por `InstitutionalReceiptPdfService::pdfForDraft`).
- No consume correlativo fiscal (`reserved_number: false`).

## 6. Backend: enforcement del modo normal

El backend rechaza explícitamente cualquier intento de escribir los campos manuales sin el permiso `receipt_settings.advanced`:

```text
PUT /api/receipts/profiles/{id}
Body:
  - copies_mode           -> permitido a todos los editores de recibo
  - use_logo              -> permitido
  - show_copy_legend      -> permitido
  - show_physical_seal_space -> permitido
  - active                -> permitido
  - is_global_default     -> permitido

  - width_mm              -> requiere receipt_settings.advanced
  - height_mm             -> requiere receipt_settings.advanced
  - margin_top_mm         -> requiere receipt_settings.advanced
  - margin_right_mm       -> requiere receipt_settings.advanced
  - margin_bottom_mm      -> requiere receipt_settings.advanced
  - margin_left_mm        -> requiere receipt_settings.advanced
  - font_family           -> requiere receipt_settings.advanced
  - font_scale            -> requiere receipt_settings.advanced
```

Si la request llega sin el permiso y trae cualquiera de los campos avanzados → `403 Forbidden` con `audit log action="receipt_settings.advanced_denied"` y mensaje al usuario:

> Este cambio requiere el permiso `receipt_settings.advanced`. Solicite soporte técnico.

Si llega con permiso → se acepta el cambio, se persiste, y se audita en `audit_logs` con `action="receipt_print_profile.updated"`, `old_values` y `new_values` completos.

## 7. UI

### 7.1 Flujo normal (operación diaria)

Solo se exponen:

- Selector de perfil cerrado (`<PaperProfileSelector>` con 5 tarjetas).
- Selector de **copias** (1, 2, 3).
- Checkbox **Mostrar logo autorizado**.
- Checkbox **Espacio para sello/firma**.
- Botón **Imprimir prueba** (genera PDF con watermark, sin consumir correlativo).
- Botón **Guardar perfil**.
- Texto informativo: "Los márgenes y el tamaño se calculan automáticamente según el perfil seleccionado."
- Vista previa real usando el mismo CSS de impresión.

### 7.2 Flujo avanzado (soporte técnico, oculto por defecto)

Requerimientos:
- Permiso `receipt_settings.advanced`.
- Advertencia visible: "Cambiar márgenes o tamaño puede afectar recibos impresos."
- Audit log automático.
- Botón dedicado "Activar modo soporte" con `aria-controls` apuntando al `<AdvancedSettingsAccordion>`.

Cuando se activa, muestra los 8 campos manuales antiguos (ancho, alto, 4 márgenes, fuente, escala) y la asignación por scope.

## 8. Pruebas

- Unit/feature: `ReceiptPrintProfileTest` cubre el rechazo 403 sin permiso y el 200 con permiso.
- Snapshot: `ReceiptPreview.snapshots.test.tsx` asegura que el HTML del recibo por cada perfil coincide con un baseline.
- e2e Playwright: `e2e/print-profiles.spec.ts` carga preview por perfil, hace screenshot y compara con baseline `qa/refactor/print-profiles/*.png`.
- Manual: `docs/checklists/print-checklist.md` con casos imprimibles en cada perfil físico.

## 9. Compatibilidad

- Los `code` (`carta`, `media_carta`, etc.) son los identificadores públicos en API.
- El backend mantiene los `code` históricos (`recibo_pequeno_personalizado`, `media_carta_horizontal`, `a5_horizontal`, `carta_horizontal`, `thermal_80mm`, `thermal_58mm`) en la tabla `receipt_print_profiles`. La UI los mapea de forma transparente.
- Datos existentes (perfiles sembrados, asignaciones globales) siguen funcionando.
