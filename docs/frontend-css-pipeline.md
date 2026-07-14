# Pipeline CSS final del frontend

## Flujo efectivo

1. `src/styles.css` importa `tailwindcss` y después los tokens institucionales.
2. `@tailwindcss/vite` participa en el pipeline de Vite antes de la emisión CSS.
3. La directiva `@theme` de `src/design-system/tokens/institutional-tokens.css` es consumida por Tailwind durante esa transformación.
4. Lightning CSS recibe el CSS emitido, no una directiva `@theme` sin procesar.

No existe configuración PostCSS paralela ni un segundo plugin Tailwind. Mantener una sola integración evita que Lightning CSS analice sintaxis fuente de Tailwind fuera de orden.

## Evidencia

- `npm run build`: aprobado, sin warning `@theme`.
- `npm run test:storybook`: 3 archivos y 16 tests aprobados, sin warning `@theme`.
- `rg "@theme" frontend`: una única definición central en `src/design-system/tokens/institutional-tokens.css`.

Decisión: conservar `@tailwindcss/vite` como único transformador y la definición `@theme` dentro del archivo central de tokens. No se añadió supresión ni configuración duplicada.
