# 05 Design System And Libraries

## Objetivo

Fase 12 debe usar una base visual profesional y consistente. No se debe improvisar estilos manuales para cada pantalla.

## Librerias recomendadas

- `shadcn/ui` o `Radix UI` para primitives accesibles.
- `TanStack Router` o `React Router` para rutas internas.
- `TanStack Query` para API/cache controlado.
- `TanStack Table` para tablas de catalogo, historial y reportes.
- `React Hook Form` para formularios.
- `Zod` para validacion compartible en frontend.
- `Recharts` para reportes.
- `lucide-react` para iconos.
- `clsx` y `tailwind-merge` para clases.
- `Tailwind CSS` si ya aplica o si puede integrarse limpiamente.

## Estado aplicado en Fase 12

- `React Router`: aplicado para rutas separadas por modulo.
- `Radix UI`: aplicado via primitives ligeros (`Slot`) para componentes base.
- `Tailwind CSS`: aplicado como sistema de tokens y utilidades.
- `lucide-react`: aplicado en sidebar/topbar y estados visuales.
- `clsx` y `tailwind-merge`: aplicado con helper `cn`.
- `Recharts`: aplicado en reportes para el grafico de servicios mas vendidos.

Pendiente de adopcion gradual, solo cuando el modulo lo justifique:

- `TanStack Query`: recomendable si se amplian estados de cache, invalidacion y polling.
- `TanStack Table`: recomendable si catalogo/historial/reportes crecen a ordenamiento y columnas configurables.
- `React Hook Form` + `Zod`: recomendable para formularios grandes con validacion compleja compartible.

## Reglas de adopcion

- Validar dependencias existentes antes de instalar.
- No agregar librerias por comodidad.
- Cada libreria debe resolver un problema claro de Fase 12.
- Mantener build offline para produccion LAN: las dependencias se instalan en desarrollo/build, no se consumen desde CDN en runtime.

## Tokens iniciales

- Paleta sobria hospitalaria, no monocroma.
- Tipografia legible para caja.
- Espaciado compacto y consistente.
- Estados semanticos: exito, advertencia, error, informacion.
- Componentes de alta densidad para pantallas operativas.

## Componentes obligatorios

- Botones con variantes.
- Inputs con labels y errores.
- Selects/combobox.
- Tabs o segmented controls.
- Data tables.
- Dialogs de confirmacion.
- Toasts.
- Metric cards.
- Badges de estado.

## Criterio visual

Si la UI se ve como maqueta basica, Fase 12 queda bloqueada.
