# Ensayo de backup y restauración

Fecha: 2026-07-21.

## Ejecución

1. Se creó un respaldo manual desde el compose de producción aislado.
2. El resultado fue un `*.sql.gz.enc` de 114.488 bytes.
3. Se comprobaron checksum SHA-256, formato SQL, compresión gzip, `encrypted=true` y una huella de clave no reversible de 64 caracteres.
4. Se descifró e importó en `hospital_restore_audit`.
5. Se compararon conteos críticos y el total financiero de la factura E2E.
6. Se ejecutó rollback/reaplicación de la última migración sobre esa copia.
7. El SQL temporal descifrado fue eliminado.

## Resultado

Users, invoices, payments y institutional receipts coinciden 4/4, 1/1, 1/1 y 1/1. La factura conserva total 1.725 centavos y estado pagado. La diferencia temporal de tres audit logs se explica por eventos posteriores al dump. El backup que estaba `pending` en el instante de captura se reconciliará como fallido al restaurar, evitando un estado operativo falso.

La restauración no expuso endpoint web y no alteró la base de producción ni la base compartida de desarrollo.
