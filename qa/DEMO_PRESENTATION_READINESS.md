# Demo presentation readiness

Estado al 2026-05-18: **DEMO_READY** y **PRODUCTION_CANDIDATE**.

No declarar **PRODUCTION_READY**. La demo esta lista para presentacion local controlada, con limitaciones honestas de entorno final.

## Usuario demo

- Principal para guion completo: `admin.demo` / `Password123!`.
- Para mostrar flujo de caja puro: `cajero.demo` / `Password123!`.
- Para reportes sin configuracion fiscal/backups: `supervisor.demo` / `Password123!`.
- Los usuarios demo se crean solo en `local` o `testing`; produccion debe usar admin real con cambio obligatorio de password.

## Datos demo validados

- Catalogo: 122 servicios activos desde `backend/database/seeders/data/catalogo_servicios_inicial.csv`.
- Categorias visibles: 5 categorias claras de servicios hospitalarios.
- Regla critica: `Eritropoyetina` cuesta L.25.00 y aplica regla especial de dialisis desde backend.
- Codigos demo para scanner:
  - Acido Urico: `LAB-ACIDO-URICO`, barcode `7700000001001`, QR `QR-LAB-ACIDO-URICO`.
  - Abdomen Simple: `RX-ABDOMEN`, barcode `7700000002001`, QR `QR-RX-ABDOMEN`.
- Configuracion fiscal demo: Hospital Demo, RTN `08011999123456`, CAI `DEMO-CAI`, prefijo `000-001-01`, recibo 80mm.

## Guion recomendado

1. Login en `/login` con `admin.demo`.
2. Dashboard: explicar estado operativo, caja y accesos principales.
3. Caja: abrir o confirmar caja abierta con L.500.00.
4. Nueva factura: mostrar que no se puede emitir sin paciente/servicio/caja.
5. Buscar servicio por categoria o texto: `Glucosa`, `Hemograma`, `Eritropoyetina`.
6. Buscar codigo demo en scanner: `LAB-ACIDO-URICO`.
7. Agregar servicios y emitir factura.
8. Cobrar con efectivo y mostrar cambio si aplica.
9. Mostrar recibo termico 80mm y alternar a 58mm. No prometer impresora fisica validada.
10. Historial: buscar la factura emitida, abrir detalle y reimprimir con motivo.
11. Catalogo: mostrar categorias, estado activo/inactivo y codigos.
12. Reportes: mostrar reporte diario, rango, categorias, servicios, caja y auditoria.
13. Backups: mostrar listado y creacion en cola local. No ejecutar restore real durante demo.
14. Configuracion fiscal: mostrar hospital, RTN, CAI, rango y ancho de recibo.

## Evidencia vigente

- Smoke visual: `qa/visual-smoke/phase-12-visual-smoke.mjs`.
- Resultado: `qa/screenshots/phase-12-visual-smoke/visual-smoke-report.json`.
- URL validada: `http://127.0.0.1:8000`.
- Factura demo emitida en smoke: `000-001-01-00000034`.
- Factura demo emitida en pasada manual final: `000-001-01-00000036`.
- Consola: 0 errores.
- Hallazgos del smoke: 0.
- Capturas vigentes:
  - `qa/screenshots/phase-12-visual-smoke/dashboard.png`
  - `qa/screenshots/phase-12-visual-smoke/billing-new-empty.png`
  - `qa/screenshots/phase-12-visual-smoke/billing-new-with-services.png`
  - `qa/screenshots/phase-12-visual-smoke/billing-confirm-modal.png`
  - `qa/screenshots/phase-12-visual-smoke/receipt-preview.png`
  - `qa/screenshots/phase-12-visual-smoke/cashbox.png`
  - `qa/screenshots/phase-12-visual-smoke/invoices-history.png`
  - `qa/screenshots/phase-12-visual-smoke/catalog.png`
  - `qa/screenshots/phase-12-visual-smoke/reports.png`
  - `qa/screenshots/phase-12-visual-smoke/backups.png`
  - `qa/screenshots/phase-12-visual-smoke/fiscal-settings.png`

## Zonas que no se deben vender como cerradas

- Impresora termica fisica 80mm/58mm: pendiente hasta probar hardware real.
- LAN desde otra PC: pendiente hasta validar desde cliente fisico por IP/nombre del servidor.
- Restore real durante la presentacion: evitarlo; el restore es destructivo y debe ejecutarse solo en base descartable.
- Configuracion final de produccion: pendiente hasta preparar servidor con `APP_ENV=production`, `APP_DEBUG=false`, admin real, worker continuo de backups y `config:cache`.

## Frase honesta para presentacion

"Este demo esta listo para mostrar el flujo operativo local: caja, factura, cobro, recibo, historial, reimpresion, catalogo, reportes, backups y configuracion fiscal. No lo declaramos PRODUCTION_READY hasta validar hardware de impresora, cliente LAN fisico y configuracion final del servidor."
