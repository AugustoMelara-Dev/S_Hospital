# Cierre de violaciones legacy del frontend

Fecha: 2026-07-14.

## Línea base comparable

- Archivos auditados inicialmente: 406.
- Violaciones individuales iniciales: 177.
- Manifiesto individual: `docs/frontend-final-legacy-manifest.md`.

## Resultado final

```text
npm run check:ui-legacy
[INVENTORY] modo=inventory; 329 archivos; 0 violaciones.

npm run check:ui-legacy:strict
[QUALITY GATE PASSED] modo=strict; 329 archivos; 0 violaciones.

npm run check:ui-legacy:final
[QUALITY GATE PASSED] modo=final; 329 archivos; 0 violaciones.
```

Allowlist: 0. Excepciones temporales: 0. Imports reemplazados: 0. Clases visuales prohibidas: 0. Superficies `Compat`, `Legacy`, `Old`, `V1`, `Adapter`, `Antd` o `Sheet`: 0.

`src/components/ui` y `src/components/shared` no existen. También se retiraron componentes visuales sin consumidores descubiertos durante la migración final.

Dependencias eliminadas: `@radix-ui/*`, `lucide-react`, `recharts`, `sonner`, `vaul`, `cmdk`, `motion`, `react-day-picker`, `@tanstack/react-table`, `@tanstack/react-virtual`, `class-variance-authority` y `react-to-print`.

La reducción comparable es 177 → 0. El menor conteo de archivos final se debe a la eliminación física de primitivas, wrappers, tests y componentes muertos, no a una allowlist.
