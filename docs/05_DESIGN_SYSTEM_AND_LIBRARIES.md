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
