# S_Hospital en una computadora

Actualizado el 22 de octubre de 2026. Consulte [la entrega actual](ENTREGA_ACTUAL_20260928.md) para identificar el instalador y sus comprobaciones pendientes. [Instrucciones breves del instalador](../installer/native/LEEME.txt).

## Una instalación por hospital

Los dos hospitales usan el mismo producto, con una computadora y datos independientes en cada institución. Configure nombre, logo, identificación fiscal, catálogo, impuestos, usuarios y papel en cada instalación. No copie la base de datos del primer hospital para iniciar el segundo.

Abra **S_Hospital** desde el escritorio o Inicio. El modo habitual usa Microsoft Edge en una ventana propia, en `http://127.0.0.1:8000`. No necesita XAMPP, PHP o MariaDB por separado ni internet para atender. Esta guía describe una computadora; el acceso por LAN requiere preparación y comprobación específica.

## Instalar

1. Copie del kit el instalador indicado y `SHA256SUMS.txt`. Compare su SHA-256 con el publicado antes de ejecutarlo. Puede transportarlo en USB.
2. Abra el instalador y autorice UAC con una cuenta administradora de Windows.
3. Esta entrega no tiene firma Authenticode. Si aparece SmartScreen, confirme procedencia y hash; para el archivo confirmado, use **Más información → Ejecutar de todas formas**, si Windows lo ofrece. Si el hash no coincide o Windows impide continuar, contacte al responsable. No desactive la protección de Windows.
4. Cree el administrador de S_Hospital y custodie su acceso.
5. Complete la configuración descrita abajo antes de atender pacientes.

Si Windows solicita reiniciar, guarde su trabajo. Después de iniciar sesión compruebe que S_Hospital abra y permita entrar. La instalación y el reinicio comprobados para esta versión figuran en la entrega actual.

## Preparar cada hospital antes del primer cobro

- **Administración → Ajustes → Identidad:** nombre real, identificación fiscal, dirección, teléfono y logo. Mientras falte configuración, el nombre del producto es **S_Hospital**.
- **Ajustes → Numeración:** CAI, rango y fechas autorizados para esa institución, revisados por la persona responsable.
- **Ajustes → Impuestos:** cree o revise las tasas del hospital; registre el motivo que solicita la aplicación al cambiarlas.
- **Administración → Catálogo (Productos y servicios):** abra **Importar / Exportar** para cargar el catálogo propio (CSV/XLSX), revise la vista previa y corrija errores antes de confirmar. También puede administrarlo en pantalla y exportarlo. Revise precios, disponibilidad e impuesto por concepto; puede asignar tasas en lote por categoría. **Sin tasa asignada significa exento**. El catálogo de ejemplo parte exento: no presuponga que esa es la clasificación fiscal definitiva.
- **Ajustes → Impresión:** seleccione formato y ejemplares. Instale la impresora en Windows y selecciónela en el diálogo al imprimir; su papel debe coincidir con el formato.
- Prepare cajas físicas, usuarios y permisos.

La persona responsable debe aprobar catálogo y tasas antes de cobrar. Las facturas emitidas conservan sus precios e impuestos históricos aunque cambie el catálogo.

## Imprimir

El recibo institucional es el documento principal en carta, media carta o A5, según la configuración disponible. Las térmicas de 80 mm y 58 mm usan un ticket específico.

1. Abra el PDF y elija la impresora correcta.
2. Seleccione el tamaño correspondiente, **escala 100 % / tamaño real** y desactive **encabezados y pies de página**. No use “ajustar a página” para corregir un papel mal configurado.
3. Para térmica seleccione también 80 o 58 mm en el controlador de Windows.
4. Pruebe en papel: nombre completo, importes legibles, totales y firmas sin cortes. Con dos ejemplares revise ambos y la línea de corte.

Revisar PDFs no sustituye la prueba física del hospital. Si falla imprimir después de cobrar, vaya a **Recibos** y reimprima la operación existente; no cree otra factura.

## Uso diario

Abra caja, escriba el nombre del paciente, agregue conceptos y revise el total del servidor antes de confirmar. Seleccione el método de pago correcto. La receta/diálisis solo libera de cobro la línea elegible de eritropoyetina; los demás conceptos mantienen su importe. Una cuenta íntegramente gratuita se emite sin pago ficticio.

Revise operaciones en **Recibos**. Anular requiere permiso y motivo. Al terminar, revise movimientos y arqueo, concilie la diferencia y cierre caja. **Ayuda** muestra instrucciones según el rol.

## Actualizar

1. Termine el cobro en curso y cierre S_Hospital.
2. Verifique y copie el nuevo instalador a la misma computadora.
3. Ábralo y use **Actualizar S_Hospital** cuando reconozca la instalación. **No desinstale la versión anterior.**
4. Espere el resultado: conserva datos y configuración y prepara un respaldo previo.
5. Compruebe acceso, datos y una reimpresión antes de reanudar atención.

No hay búsqueda de versiones por internet ni suscripción obligatoria. La actualización puede llegar por USB.

## Respaldos y recuperación

- En **Administración → Mantenimiento → Respaldos** revise las copias y cree una manual según sus permisos. Compruebe integridad y descarga.
- Conserve copia y kit de recuperación fuera de la computadora, bajo custodia del hospital. Mantenga separada la frase del kit.
- En Inicio, **Respaldos y recuperación de S_Hospital** guía la recuperación.
- **Recuperar acceso a S_Hospital**, desde Inicio, requiere autorización de un administrador de Windows.
- Integridad y restauración comprobada son resultados diferentes. Antes de puesta en servicio valide una restauración en un entorno separado.

## Alcance

El [estado de entrega](ENTREGA_ACTUAL_20260928.md) enumera evidencia y límites. Esta guía describe uso; no certifica por sí sola instalación elevada, reinicio, Windows limpio ni impresora física.
