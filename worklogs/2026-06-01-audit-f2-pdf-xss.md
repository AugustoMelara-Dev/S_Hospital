# F2 — Producción: XSS en PdfExportService

**Fecha:** 2026-06-01
**Fase del plan:** 2 de 12
**Rama:** `codex/audit-f1-config-hardening`
**Commits aplicados:**
- `b66fc35f fix(reports): escape pdf export html` (producción, por otro agente)
- `5ea779fb test(reports): cover pdf export html escaping` (este commit)

## Hallazgos cerrados

- **CRÍTICO** `backend/app/Actions/Reports/PdfExportService.php` — múltiples strings controlados por el usuario (hospital name, RTN, fechas, método de pago, contadores) se interpolaban directamente en HTML sin escapar. Esto abría vectores XSS persistentes: un atacante con permisos de admin podría inyectar `<script>` o `<img onerror>` en el nombre del hospital o RTN, y el payload se ejecutaría al abrir el PDF (DomPDF puede ejecutar JS dependiendo de la configuración del visor).

## Cambios

- `app/Actions/Reports/PdfExportService.php` (producción) — método público `e()` que aplica `htmlspecialchars($v, ENT_QUOTES | ENT_HTML5, 'UTF-8')`. Variables escapadas a través de todas las ramas de `generateDailyClosurePdf` y `generateRangeClosurePdf`. Refactor mínimo: las dos funciones ahora delegan a `buildDailyClosureHtml` y `buildRangeClosureHtml` para que el HTML sea testeable sin decodificar el PDF binario.
- `tests/Unit/PdfExportEscapingTest.php` (nuevo) — 5 tests:
  - `<script>...</script>` en hospital name (daily) → se codifica como `&lt;script&gt;`
  - `<img onerror=...>` en RTN (daily) → se codifica
  - `<svg/onload=...>` en hospital name (range) → se codifica
  - `e()` escapa los 5 caracteres especiales (`<`, `>`, `"`, `'`, `&`)
  - `e(null)` retorna string vacío

## Decisiones técnicas

- **`ENT_QUOTES | ENT_HTML5, 'UTF-8'`** — escapa comillas simples y dobles (necesario para atributos HTML como `class='text-center'`), usa entity set de HTML5 y garantiza UTF-8. Esta es la configuración más segura por defecto para contenido que se va a renderizar como HTML.
- **Refactor a `build*Html()`** — necesario para que el test pueda verificar el HTML sin decodificar el PDF binario. El método público que genera el PDF ahora es de 3 líneas: `return Pdf::loadHTML($this->buildDailyClosureHtml(...))->output();`. Costo: una llamada a método extra, ganancia: testabilidad.
- **Mantener `e()` público** — es un helper de sanitización genérico. Hacerlo público permite reutilización y testing directo. No expone información sensible.

## Quality gate

```
phpunit      → 248 tests, 1704 assertions OK (5 nuevos)
pint         → passed
```

## Riesgos

- **Bajo.** El escape es por string. El PDF generado por DomPDF sigue siendo el mismo formato, solo con caracteres HTML-encoded. El cambio es invisible para un visor de PDF normal.
- **Bajo.** Si en el futuro alguien quiere permitir etiquetas HTML limitadas en el hospital name (por ejemplo, `<b>` para negrita), tendría que cambiar el helper a algo más sofisticado (DOMPurifier, allowlist). Por ahora, escape total es lo correcto.

## Próxima fase

F3 — Mover math de dinero de SQL float a PHP cents: aplicar la regla "evitar lógica de dinero en floats; usar enteros en centavos" a `BuildCashReconciliationAction` y los report services. Cambiar `ROUND(balance_due * 100)` por sumas en PHP sobre `amount_cents` ya existente en `payments`.
