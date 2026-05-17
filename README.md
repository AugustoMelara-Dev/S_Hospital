# Hospital Billing OS - Paquete Final UX/UI + Producto Real

Este paquete corrige la dirección del proyecto después de la validación técnica: el backend/core puede estar fuerte, pero la experiencia de usuario no está lista para entregar como producto profesional.

Objetivo: convertir el sistema de una aplicación funcional pero plana en un producto hospitalario de caja/facturación con UX real, sidebar, módulos separados, POS rápido, catálogo por categorías, escaneo de código/QR, reportes avanzados y criterios de aceptación estrictos.

## Orden de uso con Codex

1. Copiar este paquete completo en la raíz del repo.
2. Crear branch: `feature/final-product-ux-rebuild`.
3. Ejecutar `prompts/00_FINAL_PRODUCT_PLAN_MODE.md`.
4. Ejecutar `prompts/01_FINAL_PRODUCT_PLAN_REVIEW.md`.
5. Aprobar plan manualmente.
6. Ejecutar fases una por una:
   - Fase 12A: App Shell + navegación + design system.
   - Fase 12B: POS/facturación rápida por categorías, búsqueda y scanner.
   - Fase 12C: Catálogo profesional + códigos QR/barcode.
   - Fase 12D: Reportes avanzados.
   - Fase 12E: Pulido visual, QA UX y demo final.
7. Después de cada commit, ejecutar `prompts/06_COMMIT_REVIEW_FINAL_PRODUCT.md`.

## No negociar

- No dejar todo en una sola página.
- No dejar listas interminables sin categorías/filtros.
- No entregar UI sin layout profesional.
- No usar frontend monolítico como producto final.
- No implementar reportes avanzados sumando en el frontend.
- No afirmar production-ready si impresora/LAN/restore/concurrencia siguen pendientes.

## Stack recomendado

- React + TypeScript + Vite.
- Tailwind CSS + shadcn/ui.
- TanStack Router o React Router.
- TanStack Query.
- TanStack Table.
- React Hook Form + Zod.
- Lucide React.
- Recharts.
- date-fns.
- @zxing/browser para cámara/QR opcional.
- USB scanner como input tipo teclado.
- Laravel API + MySQL/MariaDB.
