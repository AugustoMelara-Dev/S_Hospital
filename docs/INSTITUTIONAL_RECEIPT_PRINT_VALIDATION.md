# Validacion de impresion del recibo institucional

Estado actual: PENDING_HARDWARE_VALIDATION hasta probar en impresora fisica los perfiles aprobados por el hospital.

El formato principal es un PDF de recibo institucional clasico desde la entidad `institutional_receipts`, con snapshot historico, numero/serie propio y tamano real segun perfil. Los formatos compactos 80mm/58mm quedan como compatibilidad secundaria.

No se debe imprimir sello ni firma oficial digital por defecto. El recibo deja espacio para sello fisico y firma manual, salvo que una autoridad del hospital cargue un recurso autorizado en configuracion.

## Equipo

- PC de caja identificada.
- Navegador que usara el cajero identificado.
- Impresora instalada o compartida en la PC de caja.
- Formatos habilitados en el driver: media carta horizontal, A5 horizontal, carta horizontal o tamano personalizado medido por el hospital. 80mm/58mm solo si se decide usar compatibilidad termica.
- Impresora correcta seleccionada como predeterminada o elegida manualmente.

## Configuracion del navegador

- Escala 100% o "Tamano real".
- Desactivar "Ajustar a pagina", "Reducir paginas grandes" o cualquier opcion que escale automaticamente.
- Margenes controlados por el PDF; no agregar margenes del visor si el driver lo permite.
- Encabezados y pies desactivados cuando el navegador lo permita.
- Tamano de papel del driver configurado igual que el perfil elegido en Ajustes.
- Prueba realizada desde la PC real de caja, no solo desde desarrollo.

## Perfiles soportados

- `recibo_pequeno_personalizado`: ingresar ancho y alto exactos en milimetros desde Ajustes. Requiere que Windows/driver acepte ese tamano personalizado.
- `media_carta_horizontal`: 8.5 x 5.5 pulgadas, recomendado como formato practico para impresora normal.
- `a5_horizontal`: alternativa compacta estandar si la impresora no maneja media carta o personalizado.
- `carta_horizontal`: respaldo para archivo o impresoras que no aceptan formatos menores.

Si la impresora no respeta papel personalizado, cambiar la caja/equipo a media carta o A5 desde Ajustes. El flujo operativo no debe exigir recortes manuales.

## Prueba de emision principal

1. Iniciar sesion como cajero.
2. Abrir caja.
3. Crear factura con paciente y al menos un servicio.
4. Cobrar factura.
5. Confirmar que el sistema abre o descarga el PDF institucional numerado.
6. Imprimir desde el visor PDF con escala 100% / tamano real.
7. Confirmar fondo blanco, lectura clara y una sola factura/recibo por impresion.
8. Confirmar campos visibles minimos: numero de recibo, serie, monto, fecha, enterante/paciente, cantidad en letras, concepto, firma del enterante, espacio para sello/firma oficial y leyenda de copias.
9. Confirmar que no imprime QR, codigo de barras, codigos internos, IDs, logs, auditoria ni estado tecnico.
10. Confirmar que no aparece sello digital falso.

## Prueba de perfiles

1. En Ajustes > Recibos, seleccionar `media_carta_horizontal`.
2. Imprimir prueba y confirmar marca visible de prueba/borrador.
3. Repetir con `a5_horizontal`.
4. Si el hospital ya midio el papel fisico, configurar `recibo_pequeno_personalizado` con ancho/alto exactos en mm y repetir prueba.
5. Probar `carta_horizontal` solo como respaldo/archivo si el hospital lo solicita.
6. Registrar si cada perfil sale a tamano real o si el driver fuerza escalado.

## Reimpresion

1. Reabrir el PDF de un recibo ya emitido desde el flujo disponible.
2. Ingresar motivo si el sistema lo solicita para reimpresion.
3. Confirmar auditoria en backend (`institutional_receipt_print_events` y `audit_logs` si aplica).
4. Confirmar que numero, serie, monto, paciente, concepto y textos historicos coinciden con el recibo original aunque Ajustes haya cambiado.

## Copias

Por defecto operativo recomendado: solo original impreso + copia digital guardada en sistema.

Si el hospital exige copias fisicas:

1. Configurar modo de copias en el perfil de impresion.
2. Emitir PDF de prueba.
3. Confirmar que cada pagina/copia queda llena y marcada como ORIGINAL, PRIMERA COPIA o SEGUNDA COPIA.
4. Confirmar que no se obliga al cajero a recortar hojas como parte normal del flujo.

## Resultado

Registrar:

- Fecha.
- Operador.
- PC de caja.
- Modelo de impresora.
- Formato probado: media carta, carta, A5, 80mm, 58mm o combinacion aprobada.
- Resultado: VALIDATED o FAILED.
- Observaciones de margenes, escala o driver.
- Perfil configurado en Ajustes y, si aplica, ancho/alto personalizado en mm.
- Si se uso fallback: motivo para cambiar de personalizado a media carta/A5.
