# 07 Final Phases Roadmap

## Regla general

Fase 12 se implementa en ramas `codex/*`, por fases pequenas, verificables y commiteables. No empujar directo a main salvo hotfix explicito.

## 12A App Shell + Sidebar + Design System

Alcance:

- Crear layout persistente.
- Crear sidebar, topbar y rutas internas.
- Integrar librerias UI aprobadas.
- Separar la pagina actual en modulos navegables sin cambiar reglas de negocio.

Criterio:

- La app deja de sentirse como pagina interminable.

## 12B POS Billing UX profesional

Alcance:

- Redisenar Nueva factura como POS.
- Busqueda, categorias, tarjetas/tabla compacta, carrito lateral, pago y recibo.
- Mantener backend como fuente de verdad.

Criterio:

- Facturar se siente como caja rapida.

## 12C Catalogo + barcode/QR/scan_code

Alcance:

- Administrar categorias y servicios.
- Editar precio, activo/inactivo, scan_code.
- Agregar migracion/API si no existe soporte de codigo.
- Soportar busqueda por codigo desde POS.

Criterio:

- No hay lista interminable; servicios se administran y facturan por categoria/codigo.

## 12D Reportes avanzados

Alcance:

- Dashboard gerencial.
- Reportes por fecha, metodo, categoria, cajero, estado, anulaciones, reimpresiones y backups.
- Tablas, metricas y graficas.

Criterio:

- Reportes sirven para gerencia, no solo para validacion guiada.

## 12E QA UX final e institucional

Alcance:

- Smoke de navegacion.
- Flujo crear factura, cobrar, imprimir, reimprimir, anular y reportar.
- Validacion visual contra criterios de bloqueo.
- Guion de validacion final.

Criterio:

- Producto demostrable sin disculpas por UX.
