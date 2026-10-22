# Perfiles de impresión del recibo institucional

Autor: hs-receipts (tarea M-W2-RCP-01). Fecha: 2026-09-17.
Mandato vigente: `hospital-ai/MANDATO_DEFINITIVO.md` §12 y §13.
Raíz: `C:\Projects\S_Hospital_AI` (worktree aislado).

Este documento es la referencia viva de los perfiles de papel del recibo
institucional, su geometría exacta y la brecha de esquema pendiente para
`letter_portrait` / `a4_portrait`.

## 1. Perfiles sembrados

`backend/database/seeders/ReceiptPrintProfileSeeder.php` usa `firstOrCreate`:
solo inserta códigos faltantes. **Nunca sobrescribe** un perfil existente, por lo
que las instalaciones ya sembradas conservan su configuración y los recibos
emitidos conservan su `profile_snapshot`.

| Código | Nombre | `paper_kind` | Tamaño (mm) | Puntos PDF | Orientación | Márgenes | Copias | Activo | Predeterminado |
|---|---|---|---|---|---|---|---|---|---|
| `carta_vertical` | Carta vertical | `letter_portrait` | 215.90 × 279.40 | 612 × 792 | vertical | 12 mm | 3 | sí | **sí** (instalación nueva) |
| `media_carta_horizontal` | Media carta horizontal | `half_letter_landscape` | 215.90 × 139.70 | 612 × 396 | apaisado | 6 mm | 3 | sí | no (histórico; R2-RCP-01 lo reapunta solo si era el default apaisado legacy) |
| `a4_vertical` | A4 vertical configurable | `a4_portrait` | 210.00 × 297.00 | 595.28 × 841.89 | vertical | 12 mm | 1 | sí | no |
| `a5_horizontal` | A5 horizontal | `a5_landscape` | 210.00 × 148.00 | 595.28 × 419.53 | apaisado | 6 mm | 1 | sí | no |
| `carta_horizontal` | Carta horizontal | `letter_landscape` | 279.40 × 215.90 | 792 × 612 | apaisado | 8 mm | 1 | sí | no |
| `recibo_pequeno_personalizado` | Recibo pequeño personalizado | `custom_mm` | 180.00 × 95.00 | — | apaisado | 5 mm | 1 | no | no |
| `thermal_80mm` / `thermal_58mm` | Térmicas | `thermal_*` | 80 / 58 mm | — | vertical | 3 / 2 mm | 1 | no | no |

Notas (actualizado en R2-RCP-01, 2026-09-18):

- **Carta vertical (612 × 792 pt) es el diseño principal propuesto** y desde
  C1-RCP-02 es el **único perfil global por defecto de una instalación NUEVA**
  (catálogo `receipt_print_profiles` vacío antes de sembrar). El seeder siembra
  todos los perfiles sin la marca y después promueve `carta_vertical` una sola
  vez; el guard `uniq_receipt_print_profiles_global_default` garantiza que nunca
  haya dos.
- **R2-RCP-01 corrige el caso de la instalación existente.** Si su
  `is_global_default` declarado es un perfil **apaisado legacy**
  (`media_carta_horizontal`, `carta_horizontal` o `a5_horizontal`), el seeder
  reapunta ese único flag a `carta_vertical` mediante
  `PromoteProposedReceiptPrintProfileAction`, para que los recibos NUEVOS dejen de
  salir 612 × 396 pt. El reapunte está **acotado y auditado**: respeta una
  elección explícita no apaisada (p. ej. `a4_vertical`), no inventa un
  predeterminado si el admin lo había retirado, es idempotente, escribe
  `audit_logs` (`receipt_print_profile.promoted_default`) y **no reescribe ningún
  recibo emitido** (esos siguen su `profile_snapshot`). **No existe una migración
  de datos que invierta `is_global_default` en filas vivas**; el cambio lo hace el
  seeder/acción, nunca `migrate` por sí solo.
- El caso "instalación existente sin ningún predeterminado" (el admin lo retiró
  vía API) también se preserva: el seeder no inventa uno. El guard limita a
  **máximo uno**, no obliga a que siempre haya uno.
- **Media carta y A5 no son sinónimos** (215.9 × 139.7 vs 210 × 148). Cada uno
  conserva su rótulo, geometría y CSS.
- **A4 no es sinónimo de carta**: 595.28 × 841.89 pt vs 612 × 792 pt.
- Los perfiles apaisados y térmicos se conservan para documentos históricos; al
  reimprimir un recibo antiguo se usa su `profile_snapshot`, no el catálogo
  actual. Promover el predeterminado no reescribe recibos emitidos.

## 2. Enum nativo `letter_portrait` / `a4_portrait` (resuelto)

`receipt_print_profiles.paper_kind` nació como enum sin valores verticales de
carta ni A4 (`2026_06_14_000002_create_receipt_print_profiles_table.php`). El
contrato se cumplió en **M-W2-DB-02**: la migración
`2026_09_17_000005_extend_receipt_print_profiles_paper_kind_enum.php` (dueño
hs-db):

1. amplía el enum con `letter_portrait` y `a4_portrait` (idempotente, MariaDB y
   SQLite);
2. reapunta los perfiles EXISTENTES `carta_vertical` / `a4_vertical` de
   `custom_mm` a su valor nativo, solo si el código y la geometría exacta
   coinciden (no falla si la geometría fue personalizada);
3. no toca perfiles apaisados/térmicos ni `profile_snapshot` históricos;
4. `down()` no revierte el enum si hay filas con los valores nuevos.

**Reparto de responsabilidades (sin pisarse):**

- **Instalación existente**: la migración reapunta `custom_mm` → nativo.
- **Instalación nueva** (las migraciones corren antes que el seeder):
  `ReceiptPrintProfileSeeder` siembra ya el valor **nativo**. Ver evidencia
  M-W2-RCP-03.
- `firstOrCreate` garantiza que re-ejecutar el seeder no sobrescribe un perfil
  existente (ni los reapuntados por la migración ni los personalizados por el
  administrador).

`App\Support\PaperSize` resuelve los kinds nativos y la geometría `custom_mm`
equivalente con la MISMA conversión mm→pt (`portraitPaper` vs `customPaper`), de
modo que no hay una doble fuente de verdad silenciosa; la prueba unitaria
`ReceiptPaperProfileTest::test_native_portrait_kinds_and_custom_mm_share_one_geometry_source`
exige arrays idénticos.

## 3. Copias y reimpresión (§13)

- `copies_mode`: `original_only` (1), `original_first` (2),
  `original_first_second` (3). El PDF genera una página por copia, con el mismo
  número de documento y las etiquetas ORIGINAL / PRIMERA COPIA / SEGUNDA COPIA.
- La UI advierte **"una copia del conjunto"** para que el operador no imprima el
  conjunto tres veces.
- La reimpresión exige autorización + motivo humano (5-500) en todas las rutas
  del backend y usa el contador persistente
  `institutional_receipts.reprint_count` (institucional) o
  `invoices.legacy_reprint_count` (legacy), nunca `COUNT(audit_logs)`.
- La primera entrega nunca se etiqueta como reimpresión.
- `receipt_outcome = recovery_required` (pago registrado, recibo pendiente) se
  recupera emitiendo el recibo desde Historial; **no** genera otro cobro.

## 4. Verificación

- Backend:
  `backend/tests/Feature/InstitutionalReceiptGlobalDefaultProfileTest.php`
  (predeterminado nuevo/existente/idempotente, guard de singleton en MariaDB,
  fuente única del conteo de copias y no alteración de históricos),
  `backend/tests/Feature/InstitutionalReceiptPortraitProfileTest.php`
  y `backend/tests/Unit/ReceiptPaperProfileTest.php`.
- PDFs reales del motor (evidencia):
  `hospital-ai/evidencia/M-W2-RCP-01/` — `carta_vertical-corto.pdf`,
  `carta_vertical-largo.pdf`, `carta_vertical-cero.pdf`,
  `carta_vertical-anulado.pdf`, `carta_vertical-reimpreso.pdf`,
  `a4_vertical-*.pdf` y `dimensions.txt`.
- Evidencia C1-RCP-02: `hospital-ai/evidencia/C1-RCP-02/` —
  `DECISION_DEFAULT.md`, `CONTRATO_COPIAS_FRONTEND.md`, `PRUEBAS.md`,
  `logs/`, `pdf/` (612 × 792 con 3 copias; A4 595.28 × 841.89 con 1) y
  `preview/` (vista previa real del motor con `copy_count`).
- **NOT VERIFIED**: impresora física, papel real y control de impresión desde el
  navegador. Un PDF o una descarga no prueban que salió papel.
