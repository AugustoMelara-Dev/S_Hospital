# F1 — Gates verdes

Fecha: 2026-10-21 · Rama `release/entrega-20261021`.

Runtime de verdad: PHP 8.3.35 del payload (`artifacts/native-payload/runtime/php/php.exe`)
con un `php.ini` de pruebas que habilita `mbstring`, `sodium`, `openssl`,
`pdo_mysql`, `pdo_sqlite`, `fileinfo`, `gd`, `intl`, `zip`.
El PHP 8.2 de XAMPP se descarta como autoridad: no incluye Argon2id.

## Resultados

| Gate | Comando | Resultado |
|---|---|---|
| TypeScript | `npx tsc --noEmit` (frontend) | **0 errores** |
| ESLint | `npx eslint .` (frontend) | **0 problemas** |
| Vitest | `npx vitest run` (frontend) | **151 archivos · 1241/1241 OK · 182 s** |
| Build | `npm run build` (frontend) | **OK** (tsc + vite + `check-product-delivery`) |
| PHPUnit | `php vendor/bin/phpunit` (PHP 8.3) | **(ver cierre abajo)** |
| Pint | `php vendor/bin/pint --test` | **passed** (12 archivos normalizados) |
| PHPStan | `php vendor/bin/phpstan analyse` | **(ver cierre abajo)** |

## H-11 — Kit de recuperación de respaldos (Argon2id)

```
php vendor/bin/phpunit --filter 'BackupRecoveryKitServiceTest'
OK (5 tests, 14 assertions)  · PHP 8.3.35
```

Confirmado: `sodium_crypto_pwhash` y `SODIUM_CRYPTO_PWHASH_ALG_ARGON2ID13`
disponibles en el runtime del payload. Los 4 errores que el plan atribuía a
Argon2id eran **del entorno** (XAMPP 8.2), no del producto.

## Rojos corregidos (diagnóstico y contrato)

1. `ProductionDockerfileTest` — el test exigía `!frontend/vite-plugins/**$` y el
   archivo en Windows tiene CRLF. Se hizo tolerante a `\r` (el contrato es que la
   línea exista; el fin de línea es del checkout).
2. `InstitutionalReceiptCompactTemplateTest` / `Trc02EvidenceTest` — el fixture
   creaba una línea «gratuita» sin la procedencia de emisión
   (`unit_price_registered`, `rule_adjustment`). El producto sí la exige para
   marcar «Sin cobro por receta». Se completó el fixture y se alineó la etiqueta
   exacta con el contrato vigente.
3. `InstitutionalReceiptPdfTest` — esperaba la ubicación de la configuración
   (`Tocoa…`) pero la factura congela su propia identidad al emitirse
   (`La Esperanza`). Se alineó el test al contrato de congelamiento histórico.
4. `ExecutiveExport*` (3) — el contrato vigente de celdas de dinero es
   `"L." #,##0.00` (numérico con prefijo Lempira), ya exigido por
   `ExecutiveExcelExportTest`. Se alinearon los 3 asserts.

## Cifras de cierre

- **PHPStan: `[OK] No errors`** con PHP 8.3 del payload.
- **Pint: `result: passed`**.
- **PHPUnit (SQLite, PHP 8.3): 1491 tests · 11.225 aserciones · 0 fallos ·
  70 omitidos · OK** (A-03 incluido). Los omitidos son pruebas que requieren
  MariaDB/entorno (ver A-04).
- **Frontend: tsc 0 · eslint 0 · 157 archivos / 1283 tests · build OK**.
- **A-04 (MariaDB desechable)**: ver `A-04-MARIADB.md` (resultado y omitidos).

## No verificado en esta fase

- Nada de F1. La medición de tiempos de exportación (H-07) y el recorrido real
  (F3) se hacen contra el servidor real, no contra `artisan serve`.
