# Referencia: TDD y quality gates

## Pruebas críticas
- Crear factura con varios servicios.
- Calcular subtotal, ISV y total.
- Eritropoyetina L.25 normal.
- Eritropoyetina L.0 con receta de diálisis.
- Bloquear cobro si caja está cerrada.
- Cerrar caja y calcular total.
- Anular factura con motivo.
- Reimprimir factura histórica con snapshots.
- Permisos por rol.

## Quality gate sugerido
- composer validate
- php artisan test
- vendor/bin/pint --test
- vendor/bin/phpstan analyse
- npm run typecheck
- npm run lint
- npm run test
- npm run build
- npx playwright test para flujos críticos

## Política
Un commit con reglas de negocio sin tests debe considerarse incompleto.
