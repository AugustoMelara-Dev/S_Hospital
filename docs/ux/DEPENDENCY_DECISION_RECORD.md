# Dependency Decision Record

Fecha: 2026-06-25
Rama: `codex/v1-1-production-polish`

Decision por defecto: usar y perfeccionar el stack actual. No se agregan dependencias en esta fase.

| Libreria | Instalada actualmente | Decision | Motivo | Impacto offline | Impacto bundle | Riesgos | Pruebas requeridas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| shadcn/ui | No como paquete runtime; componentes locales estilo shadcn | Conservar enfoque local, no instalar CLI/blocks automaticamente | El proyecto ya posee componentes locales y Radix. Copiar/adaptar piezas pequenas es mas auditable. | Sin impacto runtime. | Sin aumento si no se instala. | Blocks externos pueden traer dependencias o estilos ajenos. | Typecheck/lint/tests de componentes si se adapta algo. |
| Radix UI | Si, primitives especificos | Conservar | Base accesible para Dialog, AlertDialog, Select, Tabs, Tooltip, Popover, Sheet. | Sin dependencia de internet en runtime. | Ya incluido; no aumentar salvo primitive necesario. | Mal uso de Title/Description/focus puede romper a11y. | Tests de dialogos, keyboard, axe focal. |
| Recharts | Si, `recharts` | Conservar | Ya resuelve charts de reportes; se requiere mejorar composicion, labels, legends, responsive y fallback tabular. | Sin internet runtime. | Ya incluido; cuidar lazy chunks. | Charts sin altura o labels tecnicos. | Reports tests, screenshots, axe/fallback table. |
| Tailwind CSS v4 | Si | Conservar | Tokens `@theme`, dark mode, utilities responsive y print son suficientes. | Sin internet runtime. | Ya incluido. | CSS global artesanal y paleta inconsistente. | Typecheck/build visual, screenshot responsive. |
| TanStack Query | Si | Conservar | Ya usado para API/cache; util para LAN y estados de servidor. | Sin internet runtime. | Ya incluido. | Invalidaciones incorrectas pueden mostrar datos viejos. | Hook tests y flujos POS/caja/reportes. |
| React Hook Form | Si | Conservar | Formularios admin/fiscal/recibos/catalogo ya lo usan. | Sin internet runtime. | Ya incluido. | Esquemas incompletos o mensajes poco claros. | Form tests y a11y labels/errors. |
| Zod | Si | Conservar | Validacion frontend y schemas existentes. | Sin internet runtime. | Ya incluido. | Divergencia con backend si se usa como autoridad fiscal. | Tests de schema y backend source of truth. |
| TanStack Table | No | No agregar por ahora | DataTable propio cubre tablas semanticas. Agregar solo si auditoria demuestra necesidad real de sorting/visibility/row selection consistente. | Requiere incluir en paquete de build si se agrega, no runtime internet. | Aumentaria bundle y complejidad. | Migracion de tablas puede romper accesibilidad o velocidad. | Si se agrega: npm install, audit, typecheck, lint, test, build. |
| Framer Motion / motion | No | No agregar | Producto operacional debe sentirse rapido, no animado en exceso. CSS/Radix estados bastan. | Sin impacto al no agregar. | Evita aumento. | Animaciones pueden distraer y afectar PCs modestas. | N/A. |
| Sonner | No | No agregar | `react-hot-toast` ya existe y hay toaster local con dedupe. Cambiar no aporta suficiente beneficio. | Sin impacto al no agregar. | Evita reemplazo. | Reemplazar toaster puede romper API existente. | N/A. |
| Date picker nuevo | No | No agregar | Mejorar controles de rango existentes primero. | Sin impacto al no agregar. | Evita peso. | Datepickers pesados elevan complejidad offline. | N/A. |
| Chart library alternativa | No | No agregar | Migrar de Recharts no es necesario y elevaria riesgo. | Sin impacto al no agregar. | Evita duplicacion. | Reescritura de reportes. | N/A. |
| MUI/AntD/Chakra | No | Rechazar | Mezclar design systems contradice el sistema local Tailwind/Radix. | Aumentaria dependencias de build. | Alto. | Inconsistencia visual y bundle grande. | N/A. |

## Decision final

No se instala ninguna dependencia nueva en Fase 3. La siguiente fase debe auditar si el DataTable propio alcanza para reportes/historial/usuarios. Solo si hay una brecha funcional concreta se reconsidera TanStack Table con pruebas completas.
