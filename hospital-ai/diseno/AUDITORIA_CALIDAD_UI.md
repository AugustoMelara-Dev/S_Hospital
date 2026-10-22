# AUDITORÍA DE CALIDAD DE UI — sistema de caja Hospital General San Isidro

- **Tarea**: T-UX-04
- **Fecha**: 2026-09-20
- **Raíz**: `C:\Projects\S_Hospital_AI` (worktree aislado, detached)
- **Ámbito de escritura**: `hospital-ai/diseno/**`, `hospital-ai/evidencia/T-UX-04/**`
- **Naturaleza**: auditoría **estática de código** + inspección de **PNG reales** ya
  existentes en `hospital-ai/evidencia/VISUAL/`. No es aprobación visual en vivo ni
  del dueño/hospital. Límite exacto de cobertura: `evidencia/T-UX-04/INFORME.md`.
- **Skills cargadas**: `better-ui`, `emil-design-eng`.
- **Estándar aplicado**: mandato CRM aportado como referencia de **calidad** (densidad,
  tablas/formularios/estados, feedback, command palette, motion, accesibilidad,
  responsive). No se propone construir un CRM ni alterar el dominio hospitalario.

## Escala de severidad

- **HIGH** — impide o degrada gravemente el trabajo diario del cajero.
- **MEDIUM** — fricción visible o inconsistencia de superficie/estado.
- **LOW** — pulido aislado.

---

## Hallazgos

| Severidad | Superficie | Ubicación | Problema | Mejora concreta propuesta | Principio |
|---|---|---|---|---|---|
| HIGH | Tablas (Recibos, Reportes, Catálogo, Resumen) | `design-system/ledger/components.tsx:699-806` (`LedgerTable`); `features/recibos/RecibosTable.tsx:145`; `features/reportes/components/ReporteTablas.tsx:55`; `features/resumen/ResumenView.tsx:214` | `LedgerTable` no expone **sorting**, visibilidad de columnas ni selección; las filas se leen en el orden fijo del servidor. `DataTable` (TanStack, con ordenamiento potencial) existe pero **no se usa** (`design-system/patterns/DataTable.tsx:33`, 0 consumidores en features). | Añadir a `LedgerTable` un contrato `sort` por columna: header como `button` con `aria-sort`, activable con Enter/Espacio y sin animación (acción de alta frecuencia); `defaultSort` por vista (Recibos: fecha desc; Catálogo: nombre). `columnVisibility` opt-in. | mandato (tablas excelentes) + better-ui (estructura) + emil (nada de motion en teclado) |
| HIGH | Global (todas las superficies) | `components/ui/command.tsx:34` (`CommandDialog`, sin consumidores); `shell/ledger/TopLedgerBar.tsx:45-176` | **No existe command palette ni búsqueda global con teclado**. `cmdk` está instalado pero muerto. El cajero no puede saltar a una operación por número/paciente sin ratón. | Montar un `CommandDialog` en `LedgerShell` con **Ctrl/Cmd+K**: ir a sección, abrir operación por número o paciente, abrir caja, generar recibo. Anunciar `aria-keyshortcuts`. | mandato (command palette / atajos) |
| MEDIUM | Resumen | `features/resumen/ResumenView.tsx:104-152,162-222` | Responde "cómo va el día" pero no **"qué necesita atención ahora"**: no hay lista accionable de pendientes de cobro, caja sin cerrar ni recibos pendientes, aunque la sesión ya trae `pending_invoice_count` / `missing_institutional_receipt_count` (`features/cash/CashBoxView.tsx:248-250`). | Bloque "Requiere atención" sobre las métricas: contador + CTA por caso (Cobrar pendientes → Recibos; Cerrar caja → Caja; Recibos faltantes → Recibos). Ocultarlo cuando todo está en cero. | mandato (resumen orientado a acción) |
| MEDIUM | Cobrar — catálogo | `hooks/useServices.ts:15-20`; `features/cobrar/CobrarView.tsx:83-92` | La búsqueda de catálogo **no tiene debounce**: cada tecla dispara una consulta nueva. En LAN/offline genera carga y parpadeo de resultados. | Debounce de 200-300 ms (`useDeferredValue` o temporizador) con cancelación por `AbortController`; mantener `placeholderData`. | better-ui/performance + operación LAN |
| MEDIUM | Caja | `features/cash/CashBoxView.tsx:555-564` | El buscador "Buscar movimiento…" se pinta en **todas** las pestañas (Resumen, Arqueo, Cierre) y al escribir ejecuta `setActiveView('movements')`: interrumpe un arqueo a medio contar y no corresponde a la tarea de la pestaña. | Renderizar el buscador solo en la pestaña **Movimientos**; si se invoca desde otra, no cambiar de pestaña sin confirmación. | mandato (estados/feedback) + better-ui |
| MEDIUM | Responsive / táctil | PNG `09-cobrar-390x844.png`; `features/recibos/RecibosTable.tsx:54-142`; `design-system/ledger/components.tsx:724-731` | En 390 px las tablas esconden columnas tras scroll horizontal interno (se corta "CATEGORÍA / PRECIO / ACCIÓN" y el total de líneas). El documento no desborda, pero la información no se ve sin scroll lateral. | Bajo `<sm`, transformar la fila en tarjeta apilada `label: valor` o priorizar columnas y mover el resto a "ver más". | mandato (responsive/touch) |
| MEDIUM | Teclado global | `features/cash/CashBoxView.tsx:259-271`; `features/invoices/components/InvoiceConfirmation.tsx:90`; `PaymentModal.tsx:167-236` | Poder de teclado casi inexistente: sólo **F2** (foco al monto de apertura) y **Ctrl+Enter** (confirmar). Sin ayuda de atajos ni `aria-keyshortcuts`. El comentario de F2 referencia `lib/shortcuts.ts`, **archivo que no existe**. | Ayuda de atajos con `?`; centralizar el registro (hook ya existe: `hooks/useKeyboardShortcuts.ts`); corregir el comentario muerto. | mandato (trabajar sin ratón) |
| LOW | Resumen | `features/resumen/ResumenView.tsx:214-220` | Las filas de "Operaciones recientes" **no son activables** (sin `onRowClick`), a diferencia de Recibos (`RecibosTable.tsx:150`). | Pasar `onRowClick` para abrir el detalle de la operación. | better-ui (filas activables) |
| LOW | Feedback | `design-system/providers/FeedbackProvider.tsx:27-41` | `Toaster` con `richColors` y `theme={isDark ? 'dark' : 'light'}` en un producto **light-first**: un `html.dark` heredado pintaría toasts oscuros fuera de la identidad ledger. | Forzar `theme="light"` y clases ledger en el `Toaster`. | emil (cohesión) + identidad |
| LOW | Higiene | `design-system/ledger/components.tsx:759` | Fallback genérico "Sin registros." para toda tabla sin `empty`. | Exigir `empty` contextual en el tipo (o documentar el fallback). | better-ui (empty states) |

---

## Top-10 priorizado por impacto en el trabajo diario del cajero

1. **Command palette / búsqueda global (Ctrl+K)** — hoy no existe; el mayor salto de poder de usuario. [HIGH]
2. **Sorting en `LedgerTable`** — sin él, encontrar la operación más reciente/alta por columna es manual. [HIGH]
3. **Resumen "Requiere atención"** — convierte métricas en acciones (pendientes, caja, recibos). [MEDIUM]
4. **Debounce del buscador de catálogo** — fluidez y menos carga en LAN. [MEDIUM]
5. **Buscador de movimientos solo en su pestaña** — evita saltos que interrumpen el arqueo. [MEDIUM]
6. **Tablas → tarjetas en móvil** — información completa sin scroll lateral oculto. [MEDIUM]
7. **Ayuda de atajos + registro centralizado** — descubribilidad del teclado. [MEDIUM]
8. **Filas de Resumen activables** — drill-down de un clic al detalle. [LOW]
9. **Toaster en identidad ledger (light)** — coherencia de feedback. [LOW]
10. **`empty` contextual obligatorio** — estados vacíos útiles por defecto. [LOW]

---

## Motion QA (mandato §45)

Verificado por código: **no hay `transition: all` ni `transition-all`** en producción (sólo en aserciones de contrato, `design-system/ledger/motion-contract.test.ts:99-103`); **no hay `scale(0)`** (los overlays entran desde `scale(0.95)`, `styles.css:253,322`); **no hay `ease-in`** en UI ledger (curvas custom en `tokens.css:66-69`); el **hover está encerrado globalmente** en `@media (hover: hover) and (pointer: fine)` (`styles.css:15-21`), lo que resuelve el hallazgo F10 previo; el **press de teclado no anima** (`[data-ledger-press]:not(:focus-visible):active`, `tokens.css:167`); el **origen de popovers** sale del disparador (`styles.css:299-306`) y los modales quedan centrados; hay **reduced motion global** (`styles.css:85-94`) y una excepción ledger que conserva color/opacidad (`tokens.css:203-238`). Sin hallazgos de motion.

## Conforme verificado (sin acción)

- **Formularios**: validación con Zod + `mode:'onChange'`, errores junto al campo con `role="alert"` (`components.tsx:180-185`), `aria-invalid`, `aria-busy`, botones deshabilitados durante el envío y guardas de doble envío (`CashBoxView.tsx:254,297`; `ServiceDrawer.tsx:81,113`).
- **Empty/error states**: contextuales y accionables, no "No data" — `RecibosView.tsx:243`, `ReportesView.tsx:206`, `ServiceCatalogTable.tsx:70`, `ResumenView.tsx:196-211`.
- **Feedback**: Sonner con duración por nivel, `id` de deduplicación (`cash:open`) y `aria-live` en la franja de contexto (`FeedbackProvider.tsx:27-41`).
- **Cobrar**: previsualización, guarda de revisión del carrito (`useCartRevisionGuard`), `autoFocus` en paciente y Enter-agrega-primer-resultado (`CobrarView.tsx:145-154`), barra de total fija en móvil (`CobrarView.tsx:286-313`).
- **Densidad anti-slop**: métricas como texto (no tarjetas gigantes), un solo acento de acción, sin gradientes, borde hairline en contenido y sombra sólo en overlays.

## Veredicto por superficie

| Superficie | Estado | Nota |
|---|---|---|
| Shell / navegación / contexto | Conforme | Sin command palette (hallazgo global) |
| Login / cambio de contraseña | Conforme | — |
| Resumen | Parcial | Falta bloque de acción; filas no activables |
| Cobrar | Parcial | Sólido; debounce de catálogo pendiente |
| Recibos | Parcial | Falta sorting; responsive móvil |
| Caja | Parcial | Buscador fuera de su pestaña |
| Reportes | Parcial | Falta sorting en sus tablas |
| Administración / Catálogo | Parcial | Falta sorting y acciones masivas |
| `design-system/ledger` (tabla) | Parcial | `LedgerTable` sin sorting/columnas/selección |
| Motion / accesibilidad base | Conforme | Sin hallazgos de motion |

**Global**: sin `HIGH` de accesibilidad/motion; sí hay 2 `HIGH` de capacidad operativa
(command palette, sorting). **No se emite `Approve`**: hay cobertura no inspeccionada
(PNG 10-15, lector de pantalla, Firefox/Safari, zoom 200 %, impresión física).
