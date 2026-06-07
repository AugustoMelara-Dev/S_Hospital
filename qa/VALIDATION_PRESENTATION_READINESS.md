# Validation presentation readiness

Estado actual: **PRODUCTION_CANDIDATE** para presentacion local controlada.

No declarar **PRODUCTION_READY** hasta cerrar con evidencia real: cliente LAN fisico, impresion institucional fisica, restore probado en base descartable, concurrencia MySQL/MariaDB y configuracion final del servidor.

## Usuarios de validacion

- Principal para guion completo: `admin.validacion` / `Password123!`.
- Flujo de caja: `cajero.validacion` / `Password123!`.
- Reportes y supervision: `supervisor.validacion` / `Password123!`.
- Estos usuarios existen solo para ambiente local/testing. En servidor final se debe crear personal real y exigir contrasenas propias.

## Datos de validacion

- Catalogo base: servicios activos desde `backend/database/seeders/data/catalogo_servicios_inicial.csv`.
- Areas y categorias: laboratorio, radiologia, hospitalizacion/emergencia, odontologia y medicamentos.
- Regla critica: `Eritropoyetina` cuesta L.25.00 y aplica regla especial de dialisis desde backend.
- Identificadores primarios de validacion para escaneo de servicios:
  - Acido Urico: `LAB-ACIDO-URICO`.
  - Abdomen Simple: `RX-ABDOMEN`.
- No mostrar identificadores alternos o auxiliares durante la presentacion; solo explicar que administracion puede mantenerlos en catalogo si el hospital los usa.
- Configuracion fiscal local de validacion: Hospital San Isidro, RTN local de prueba, prefijo `000-001-01` y recibo institucional.

## Guion recomendado

1. Login en `/login` con `admin.validacion`.
2. Dashboard: explicar estado operativo, caja y accesos principales.
3. Caja: abrir o confirmar caja abierta con el efectivo real autorizado.
4. Nueva factura: mostrar que no se puede emitir sin paciente, servicio y caja abierta.
5. Buscar servicio por categoria o texto: `Glucosa`, `Hemograma`, `Eritropoyetina`.
6. Buscar identificador de validacion: `LAB-ACIDO-URICO`.
7. Agregar servicios y emitir factura.
8. Cobrar con efectivo y mostrar cambio si aplica.
9. Mostrar recibo institucional en media carta/carta/A5. No prometer impresora fisica validada si no hay prueba real.
10. Historial: buscar la factura emitida, abrir detalle y reimprimir con motivo.
11. Catalogo: mostrar categorias, areas, estado activo/inactivo e identificadores administrables.
12. Reportes: mostrar diario, mensual, rango, areas, servicios, caja y auditoria.
13. Respaldos: mostrar estado `Protegido`, `Pendiente` o `Error`; crear respaldo manual solo si el entorno esta autorizado.
14. Configuracion fiscal: mostrar datos institucionales y formato de recibo.

## Evidencia vigente recomendada

- Smoke visual local: `qa/visual-smoke/phase-12-visual-smoke.mjs`.
- Evidencia mensual reciente: `qa/screenshots/rc-monthly-report-2026-05-31/`.
- Evidencia de respaldos reciente: `qa/screenshots/rc-backups-status-2026-05-31/`.
- Evidencia de soporte reciente: `qa/screenshots/rc-help-support-2026-05-31/`.

## Zonas que no se deben vender como cerradas

- Impresora institucional fisica: pendiente hasta probar hardware real.
- LAN desde otra PC: pendiente hasta validar desde cliente fisico por IP/nombre del servidor.
- Restore real: hacerlo solo en base descartable y documentar resultado.
- Configuracion final de produccion: pendiente hasta preparar servidor con `APP_ENV=production`, `APP_DEBUG=false`, admin real, tarea continua de respaldos y `config:cache`.

## Frase honesta para presentacion

"El sistema esta listo para una validacion operativa controlada: caja, factura, cobro, recibo institucional, historial, reimpresion, catalogo, reportes, respaldos y configuracion fiscal. No se declara listo para produccion final hasta completar pruebas fisicas de LAN, impresora y recuperacion."
