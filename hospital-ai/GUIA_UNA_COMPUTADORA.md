# S_Hospital en una computadora

> El candidato `.7` está construido y verificado; Windows canceló su lanzamiento elevado y su reparación real sigue pendiente. `.6` superó SQL y arranque de servicios, pero falló al preparar el administrador. No usar `.2`–`.6` para entregar el sistema. Consulte el resultado más reciente en la entrega actual antes de instalar.

## Instalar

1. Use la versión indicada en [la entrega actual](ENTREGA_ACTUAL_20260928.md) y cópiela a la computadora del hospital. Puede llevarla en una memoria USB; la instalación no necesita descargar componentes. No use el candidato anterior `.2` para cargar las tarifas: las fotografías recibidas después revelaron errores en ese catálogo inicial.
2. Abra el instalador y autorice la solicitud de Windows con una cuenta administradora del equipo.
3. Complete la creación del administrador de S_Hospital. Guarde su acceso bajo custodia del hospital.
4. Entre al sistema y complete los datos reales de la institución y la numeración autorizada en **Administración → Ajustes**. No se debe cobrar antes de completar esa configuración.
5. Revise los conceptos, tarifas e impuestos en **Administración → Catálogo y precios** antes del primer cobro. La revisión de las fotos incorpora 151 entradas, con 149 disponibles y dos variantes de K.D.H. inactivas porque la fuente repite la misma sigla con tarifas distintas. Sólo active estas últimas cuando el hospital identifique el examen correspondiente. Los precios de los carteles no establecen por sí solos si se debe agregar impuesto.

No necesita instalar XAMPP, PHP, MariaDB ni otras herramientas por separado. Al terminar, abra **S_Hospital** desde el escritorio o Inicio; la dirección local es `http://127.0.0.1:8000`. Si Windows solicita reiniciar, guarde su trabajo antes de hacerlo. Después de iniciar sesión nuevamente en Windows, compruebe que S_Hospital se abra y que pueda entrar con la cuenta creada.

El recibo ya viene preparado para **hoja carta, dos ejemplares y línea de corte**. No hace falta elegir un tamaño de papel para cada cobro. Al encender la computadora e iniciar sesión en Windows, la configuración del instalador abre S_Hospital; cada persona sigue entrando con su propia cuenta.

## Actualizar

1. Termine el cobro en curso y cierre S_Hospital antes de comenzar.
2. Copie a esa misma computadora el nuevo instalador entregado para S_Hospital.
3. Ábralo. Si reconoce la instalación existente, mostrará **Actualizar S_Hospital**. **No desinstale la versión anterior.**
4. Espere el resultado. La actualización conserva la información, prepara una copia de seguridad y comprueba que la aplicación pueda abrirse.
5. Abra S_Hospital y compruebe sus datos habituales antes de continuar la atención.

No hay búsqueda de versiones por internet ni suscripción obligatoria. Cada actualización llega como un instalador nuevo, que también puede transportarse por USB.

## Respaldos y recuperación

- En **Administración → Respaldos** puede revisar el estado de las copias y crear una manual según sus permisos.
- Conserve periódicamente una copia y el kit de recuperación **fuera de la computadora**, en una unidad bajo custodia del hospital. Una copia guardada únicamente en el mismo disco no permite recuperar un disco averiado.
- Desde Inicio de Windows, **Respaldos y recuperación de S_Hospital** guía la validación y recuperación. Mantenga la frase del kit separada de la copia.
- Si pierde el acceso del administrador único, use **Recuperar acceso a S_Hospital** desde Inicio de Windows. Se requiere autorización de un administrador de Windows en esa computadora.

## Uso diario

Abra caja, escriba el nombre del paciente, agregue conceptos del catálogo y revise el total antes de confirmar. Una receta elegible sólo libera de cobro el medicamento correspondiente; los demás conceptos mantienen su importe.

Si falla la impresión o descarga después de cobrar, busque la operación en **Recibos** y vuelva a descargar o imprimir su comprobante. No cree otra operación para imprimirla.

La sección **Ayuda** contiene las instrucciones disponibles para su rol.

## Alcance de esta guía

Describe el comportamiento implementado. Las comprobaciones realizadas y las pendientes del equipo de destino —instalación elevada, reinicio e impresora física— figuran en [el estado de entrega](ENTREGA_ACTUAL_20260928.md).





