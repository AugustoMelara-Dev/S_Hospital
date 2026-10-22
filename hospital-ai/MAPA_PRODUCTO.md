# MAPA_PRODUCTO.md — reconstrucción DEV (2026-09-18)

## Entrega local en una computadora (2026-09-28)

La última instrucción del propietario fija una sola computadora Windows offline.
El paquete nativo incluye MariaDB, PHP y servidor web en loopback; conserva
autenticación y configura servicios/launcher sin exponer la instalación a LAN.
Administración integra catálogo y precios, historial de cambios, ayuda y
respaldos; recuperación de acceso y restauración protegida se ofrecen mediante
accesos de Windows. Implementación, evidencia y límites de certificación en
[ENTREGA_ACTUAL_20260928.md](ENTREGA_ACTUAL_20260928.md).

El rediseño integral posterior unifica también formularios, menús y ventanas de
las rutas normales. El inventario ejecutado y las capturas por build están en
[REDISENO-INTEGRAL-20260928](evidencia/REDISENO-INTEGRAL-20260928/INVENTARIO.md).
El actualizador offline usa versiones identificadas por contenido, conserva
datos y configuración, verifica una copia previa con los escritores detenidos
y revierte el código ante fallos. La guía para el personal está en
[GUIA_UNA_COMPUTADORA.md](GUIA_UNA_COMPUTADORA.md); los resultados del ensayo
nativo y sus límites se registran en el estado de entrega.

La revisión UX posterior confirma estados de carga, fallo y cero en Caja,
Respaldos y Reportes. La consulta de pendientes globales usa los permisos ya
existentes; los errores de lectura no sugieren repetir cobros. Evidencia y
capturas: [revisión UX](evidencia/UX-REVISION-20260928/REVISION.md).

## Actualización de dirección (2026-09-28)

La identidad vigente pasa a azul, blanco y neutros según
`MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md`. El inventario contrastado con rutas
y endpoints actuales está en `evidencia/AZUL-BLANCO-20260928/INTEGRACION.md`.
Se añade `POST /api/invoices/receipt-preview` para el borrador institucional
valorado en servidor, sin emisión, pago ni reserva de correlativo, y
`GET /api/cash-registers` para elegir una caja física real al abrir turno.
`/propuestas/*`, `/cobrar-a` y `/cobrar-b` solo redirigen al recorrido normal
bajo sesión; los componentes y fixtures de las propuestas están archivados
fuera de `src`, `public` y el build. Las tablas posteriores se conservan como
mapa histórico de la sustitución, no como evidencia nueva de validación.

Fuente: código real de `C:\Projects\S_Hospital_AI` (reconocimiento 2026-09-18).
Este mapa gobierna la sustitución. La identidad está en
`hospital-ai/diseno/IDENTIDAD_DEV.md`.

## Secciones nuevas y destinos

| Sección | tarea | rol | ruta nueva | API/datos | reemplaza | propietario |
|---|---|---|---|---|---|---|
| Resumen | emisión/cobro/saldo/caja al corte | supervisor, admin, auditor | `/resumen` | `/api/reports/dashboard`, `/api/reports/today`, `/api/cash-sessions/current` | `DashboardView` (`/dashboard`) | hs-ui-caja/Dev |
| Cobrar | paciente→catalogo→cuenta→revisión→cobro/gratuidad→resultado | cajero | `/cobrar` | `POST /api/invoices/preview`, `POST /api/invoices`, `POST /api/invoices/{id}/payments` | `NewInvoiceView` (`/billing/new`) | hs-ui-cobro |
| Recibos | historial, detalle, PDF, reimpresión, recuperación | cajero, supervisor | `/recibos` | `GET /api/invoices`, `/api/invoices/{id}`, `/api/institutional-receipts/*` | `InvoiceHistoryView` (`/invoices`) | hs-ui-recibos |
| Caja | apertura, movimientos, conciliación, cierre | cajero, supervisor | `/caja` | `/api/cash-sessions/*` | `CashBoxView` (`/cashbox`) | hs-ui-caja |
| Reportes | período/filtros, resumen, operaciones, detalle, cobros, caja, gratuidades + XLSX/PDF | supervisor, admin, auditor | `/reportes/*` | `/api/reports/executive*` | `ReportsView` (`/reports/*`) | hs-ui-reportes |
| Administración | catálogo, usuarios, ajustes, mantenimiento | admin | `/administracion/*` | `/api/categories`, `/api/services`, `/api/admin/users`, `/api/settings/*`, `/api/backups` | `CatalogView`, `UsersView`, `FiscalSettingsView`, `InstitutionalReceiptSettingsView`, `BackupsView` | hs-ui-admin |

## Rutas antiguas → destino/retirada

| Ruta antigua | Destino |
|---|---|
| `/` | redirección por rol: cajero→`/cobrar`, resto→`/resumen` |
| `/login` | se conserva `/login` (nueva superficie de acceso) |
| `/dashboard` | redirige a `/resumen` |
| `/billing/new` | redirige a `/cobrar` |
| `/invoices` | redirige a `/recibos` |
| `/cashbox` | redirige a `/caja` |
| `/reports`, `/reports/*` | redirige a `/reportes` (subrutas vivas en `/reportes`) |
| `/catalog` | `/administracion/catalogo` |
| `/admin/users` | `/administracion/usuarios` |
| `/settings/fiscal`, `/settings/institutional-receipts` | `/administracion/ajustes` (con subrutas) |
| `/backups` | `/administracion/mantenimiento/respaldos` (secundario) |
| `/help`, `/support`, `/about` | ayuda contextual breve + `/administracion/ayuda` (secundario) |

## Contratos esenciales (resumen)

- **Paciente**: solo `patient_name` obligatorio (validado/normalizado). Sin RTN,
  contacto, expediente ni selección previa de CRM. El nombre no es clave única.
- **Catálogo**: `services` (precio en centavos, `taxable`, `active`,
  `visible_in_billing`, `is_billable`, `special_rule_code`) y `categories`.
- **Regla de diálisis**: `services.special_rule_code =
  ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION`. Condición por operación
  (`dialysis_prescription`, permiso `patients.mark_dialysis_prescription`);
  efecto **por línea** (solo el medicamento elegible baja a 0). El resto cobra.
- **Operación**: `POST /invoices/preview` (valoración sin escritura) y
  `POST /invoices` (emisión). Estados: borrador, valorada, emitida sin cobro,
  emitida pendiente de cobro, pagada, anulada/reversada.
- **Pago**: `POST /invoices/{id}/payments` con idempotencia; caja obligatoria.
- **Caja**: sesión por caja física; apertura/cierre, movimientos, efectivo
  esperado, contado/diferencia, snapshots.
- **Recibo**: `institutional_receipts`, una emisión por factura pagada; carta
  vertical 215.9×279.4 mm (612×792 pt) por defecto; un ejemplar para el paciente.
- **Reporte**: `ExecutiveReportService` (Resumen/Operaciones/Detalle/Cobros/Caja/
  Gratuidades), exportadores PDF (DomPDF) y XLSX (PhpSpreadsheet).

## Cambios de contrato requeridos

1. Emisión con total L 0 **no crea pago ficticio** ni movimientos de efectivo.
   Representar "emitida sin cobro" como estado propio; los reportes separan
   gratuidades de cobros reales.
2. Gratuidad por línea con causa (`special_rule_applied`, motivo) expuesta en la
   valoración y en los documentos; nunca un booleano raíz con descuento total.
3. Reportes: cohortes separadas de emisión, cobro y saldo al corte; gratuidades
   identificadas en XLSX (Resumen/Detalle) y PDF.
