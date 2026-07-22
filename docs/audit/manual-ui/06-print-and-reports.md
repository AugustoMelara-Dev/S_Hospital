# Documentos Impresos y Reportes - 06 Print and Reports

- **Sistema**: S_Hospital
- **Fecha**: 2026-07-22

## Evaluación de Formatos de Impresión y Reportes

### 1. Formatos de Impresión Institucional
- **Carta / Media Carta / A5**: Hojas con estilo CSS `@page` dedicado, diseño monocromático institucional, datos fiscales completos, desglose de ítems, subtotal, exento, ISV, total y firmas.
- **80mm / 58mm**: Compatibilidad para impresoras térmicas de tickets.

### 2. Exportaciones PDF / Excel
- **PDF**: Generado mediante DomPDF / HTML institucional sobrio sin gráficos innecesarios ni elementos decorativos de dashboard.
- **Excel**: Generado con tipos nativos y encabezados claros sin fórmulas inyectadas.
