# Hallazgos Funcionales - 04 Functional Findings

- **Sistema**: S_Hospital
- **Fecha**: 2026-07-22

## Hallazgos Funcionales y Soluciones de Dominio

### 1. Sincronización de Sesión de Caja en Entornos Multiusuario LAN
- **Defecto**: Apertura o cierre de caja desde otra estación o modal no invalidaba adecuadamente el estado global del frontend.
- **Corrección**: Se integró invalidación explícita de `queryKeys.cashSessions.all` en `invalidateBillingQueries` y sincronización directa en TanStack Query.

### 2. Formateo y Redondeo Monetario
- **Defecto**: Números flotantes potencialmente expuestos en serialización de reportes o resúmenes de facturación.
- **Corrección**: Garantía de conversión mediante centavos enteros (`Money::parseCents` / `formatCents`) en el backend y `font-variant-numeric: tabular-nums` en CSS.

### 3. Integridad Fiscal y Recibos Institucionales
- **Defecto**: Riesgo de desalineación en correlativo o previsualización.
- **Corrección**: Confirmación de inmutabilidad de importes y correlativos en facturas emitidas, preservando snapshots en `invoice_items`.
