# Dirección de Arte y Sistema Visual — S_Hospital AI (Gemini 3.8 Flash)

## 1. Filosofía y Propósito

El Sistema de Caja del Hospital General San Isidro es una herramienta operativa de alta frecuencia y máxima responsabilidad. Los cajeros y supervisores trabajan en turnos continuos procesando pagos, emitiendo comprobantes institucionales y cuadrando cajas físicas.

La nueva dirección visual persigue:
1. **Calma y precisión**: Menos ruido, menos cajas dentro de cajas, sin alarmas injustificadas.
2. **Jerarquía inmediata**: El ojo debe encontrar inmediatamente el nombre del paciente, el total a pagar, el botón de acción principal y el estado del documento.
3. **Ergonomía de estación de trabajo**:
   - `Cobrar` no es un formulario genérico; es una estación de facturación rápida dividida en dos áreas armónicas: Catálogo a la izquierda y Cuenta/Cobro a la derecha.
   - `Recibos` es un registro contable con filtros directos, lectura tabular y detalle lateral accesible.
   - `Caja` es una mesa de control de turno con arqueo numérico por denominaciones.
   - `Reportes` es un tablero ejecutivo con desglose modular por pestañas, no un volcado vertical de bases de datos.

## 2. Paleta Cromática y Superficies

- **Fondos de aplicación**: Neutro pizarra ultra-limpio (`#f8fafc` / `slate-50`). Proporciona luminosidad sin deslumbrar.
- **Superficies de trabajo**: Blanco puro (`#ffffff`) con bordes estructurales sutiles (`#e2e8f0` / `slate-200`) y sombras por capas transparentes de Better UI (`box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.02)`).
- **Tipografía y tinta**:
  - Títulos y encabezados: Pizarra profunda (`#0f172a` / `slate-900`), peso 600.
  - Texto base y campos: Pizarra neutra (`#334155` / `slate-700`), peso 400-500.
  - Secundario y metadatos: Pizarra suave (`#64748b` / `slate-500`).
- **Acento Primario**: Azul institucional hospitalario (`#1d4ed8` / `blue-700`, hover `#1e40af`, fondo sutil `#eff6ff`). Sereno, reconocible, confiable.
- **Semántica**:
  - Éxito / Cobrado: Esmeralda sobrio (`#059669` / `#ecfdf5`).
  - Advertencia / Diferencia de caja: Ámbar cálido (`#d97706` / `#fffbeb`).
  - Error / Anulación: Rubí hospitalario (`#dc2626` / `#fef2f2`).
  - Gratuidad exclusiva por receta (EPO): Amatista clínico (`#7c3aed` / `#f5f3ff`).

## 3. Tipografía y Cifras Monetarias

- Fuente: Sans moderna de alta legibilidad (`Geist` / `system-ui`).
- Números y montos: **Siempre con cifras tabulares** (`tabular-nums font-mono` o `font-variant-numeric: tabular-nums`).
- Formato de dinero: `L [monto]` indivisible (`&nbsp;` o `inline-flex whitespace-nowrap`), montos en tablas alineados a la derecha.

## 4. Reglas de Interacción de Emil Design Eng & Better UI

1. **Escala táctil en pulsación**: Botones principales tienen `transform: scale(0.96)` en `:active` con `transition: transform 140ms cubic-bezier(0.23, 1, 0.32, 1)`.
2. **Entrada sin escala cero**: Entradas de modales y diálogos arrancan en `scale(0.96)` + `opacity: 0`, jamás desde `scale(0)`.
3. **Popovers anclados a su origen**: Modales centrados con `transform-origin: center`; menús contextuales y popovers con origen en su botón disparador.
4. **Radios concéntricos**:
   - Tarjetas/Paneles exteriores: `rounded-xl` (12px - 14px).
   - Controles y botones interiores: `rounded-lg` (8px).
   - Badges y píldoras: `rounded-md` o `rounded-full`.
5. **Cero copy de desarrollador**: Eliminadas todas las menciones a snapshots, servidores, base de datos o explicaciones técnicas.
