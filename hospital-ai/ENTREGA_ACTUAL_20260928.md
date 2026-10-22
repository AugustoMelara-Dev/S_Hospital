# S_Hospital — entrega y comprobaciones actuales

Actualizado el 30 de septiembre de 2026. Trabajo en `C:\Projects\S_Hospital_AI`; el árbol original permanece intacto.

**Candidato `.7` construido y verificado; Windows canceló su lanzamiento elevado.** El intento `/SILENT /NORESTART` se solicitó después de comprobar independientemente el hash. Windows devolvió «El usuario ha cancelado la operación», sin crear proceso ni comenzar el bootstrap. No se declara instalación completa. [Intento real](evidencia/CATALOGO-INSTALACION-20260928/native-host-launch-2026.09.28.7.json).

[Instalador S_Hospital 2026.09.28.7](../artifacts/release/S_Hospital-2026.09.28.7-Windows-x64.exe), 102.282.425 bytes; SHA-256 `1405d59c7810af5215ace8be53be2451348de06737598125b23119887e6b99ad`. ReleaseId `2026.09.28.7-0f99bbddbf75`. [Recibo](../evidencia/ENTREGA-UN-PC-20260928/native/native-installer-receipt-2026.09.28.7.json), [10 suites focales Windows PowerShell 5.1 aprobadas](../evidencia/ENTREGA-UN-PC-20260928/native/native-focused-tests-2026.09.28.7.json), [payload y fuentes verificados](../evidencia/ENTREGA-UN-PC-20260928/native/native-payload-targeted-validation-2026.09.28.7.json). Inno 6.5.4 compiló correctamente. No está firmado con Authenticode.

`.7` corrige el rechazo falso de lectura en recuperación del administrador y el formato de cuenta de WinSW 2.12. Repara el estado exacto `.6/services_installed`: conserva DB/config/keys, corrige cinco servicios a LocalService y continúa administrador/respaldo sin repetir migraciones ni cargar el catálogo. Las pruebas de cuentas CIM son simuladas; la modificación real sigue pendiente del instalador elevado.

El último intento real `.6` superó configuración SQL, creación de tablas y arranque de seis servicios; `/up` devuelve 200 y el login azul/blanco carga desde 127.0.0.1:8000. Falló al preparar el administrador antes de mostrar su formulario. Journal services_installed/in_progress. Los cinco wrappers siguen LocalSystem hasta aplicar la reparación; MariaDB usa LocalService. La configuración conserva su hash previo. No existe administrador inicial ni respaldo inicial certificado. Los candidatos `.2`–`.6` no se recomiendan para entrega. [Historial y diagnóstico](evidencia/CATALOGO-INSTALACION-20260928/VERIFICACION-PC-ACTUAL.md).

Esta computadora tiene Windows 11 Home y herramientas de desarrollo: no equivale a Windows limpio. La evidencia de UI/documentos que sigue corresponde a los mismos assets preservados en `.7` y no sustituye certificación final del instalador. [Pasos de instalación y actualización](GUIA_UNA_COMPUTADORA.md).
## Producto implementado

- Rediseño azul, blanco y neutros aplicado a Acceso, Resumen, Cobrar, Recibos, Caja, Reportes y Administración, incluyendo formularios y ventanas secundarias. Navegación, tablas, controles, foco y mensajes comparten componentes. Las rutas normales sirven el producto; el laboratorio y sus propuestas quedan excluidos del código de entrega.
- Cobrar conserva la cuenta continua y tabla desplazable. Búsqueda y accesos frecuentes usan el catálogo real. El servidor valora importes y autoriza la gratuidad exclusivamente por medicamento elegible; paciente y receta se reinician en cada operación. Vacío, pendiente, error y cero autorizado son estados distintos.
- Catálogo y precios permite gestionar productos, servicios, categorías, disponibilidad, tarifas, impuestos autorizados e historial. Las facturas históricas conservan sus snapshots. No se fuerza el precio histórico de eritropoyetina.
- Recibos y confirmaciones mantienen la misma interfaz. El documento predeterminado es carta vertical, con ejemplar del paciente y archivo y línea de corte; las cuentas largas paginan. La configuración avanzada de papel queda en Administración, fuera del flujo cotidiano. Descargar o reimprimir no vuelve a cobrar.
- Recuperación local de acceso, ayuda por permisos, respaldos cifrados, copia externa y restauración protegida. La interfaz distingue integridad comprobada de restauración realmente probada.
- Instalación para una computadora Windows sin internet: MariaDB, PHP, servidor web, cola y programador incluidos; aplicación separada de datos. Actualización offline desde el instalador, conservación de configuración y base, respaldo previo y reversión del código si la comprobación de salud falla.

## Evidencia actual

| Comprobación | Resultado y alcance |
| --- | --- |
| UI compilada | `index-CzNgLEiZ.js` / `index-mu7J-Bh0.css`; TypeScript, lint afectado, compilación y gate sin laboratorio aprobados. El último cambio de clases móviles recibió lint focal, build y gate propios |
| Pruebas de interfaz | 79 pruebas focales aprobadas sobre formularios, permisos, navegación con borrador y Recibos; evidencia acumulada de 78 archivos / 821 pruebas mediante corrida inicial y revalidaciones, no una única corrida de 821 |
| Navegador real | Rutas principales y secundarias con backend local; capturas directas de escritorio y móvil. Recibos recibe/restaura foco, el detalle queda visible tras cargar, cancelar la salida conserva el borrador sin llamar logout y ambos botones del total mantienen altura táctil |
| Cobro completo del build final | 7/7 casos aprobados en 2,9 minutos: apertura, borrador sin emisión, cantidad 1.001, doble envío con una única factura/pago, gratuidad mixta, cero sin pago, error de valoración, fallo PDF sin recobro, exportaciones con idéntico filtro y cierre. Facturas sintéticas 31–33; sesión 13 cerrada con dos pagos por L.17.284,50 y diferencia L.0,00 |
| Catálogo | Gestión y formularios actuales recorridos sin guardar. Alta, cambio de tarifa con motivo, historial, desactivación y conservación del precio histórico comprobados anteriormente con el mismo backend; referencia histórica conservada |
| PDF y Excel del recorrido final | Descargados desde botones. Comprobante carta de dos ejemplares y cantidad 1.001; reporte PDF de nueve páginas y Excel de cinco hojas inspeccionados y contrastados contra la API del mismo filtro: L.103.851,97, 17 operaciones, 22 líneas, doce cobros y doce sesiones en ese corte. Diez páginas PDF y cinco hojas renderizadas/revisadas; archivos originales intactos. El reporte se descargó antes del cierre de sesión 13, que se acredita por separado |
| Contratos nativos | Once comprobaciones aprobadas: instalación, manifiesto, compatibilidad, identidad estable entre PowerShell 5.1/7, exclusión mutua, caché y motor de actualización/reversión |
| Contenido del paquete 2026.09.28.2 | Ensamblado y validación integral aprobados: 8.782 archivos. Incluye exactamente el build UI `CzNgLEiZ` / `mu7J-Bh0`, PHP 8.3.35, MariaDB 11.4.13, Caddy 2.11.4, WinSW 2.12.0 y runtime VC++ 14.51.36247.0 |
| Actualización con datos reales sintéticos | PASS con MariaDB/PHP/Caddy aislados y el motor compartido con el actualizador. Respaldo después de detener escritores, migración aditiva, fallo entre cambios de puntero y fallo de salud: ambos recuperan el código anterior. La factura pagada de L.184,00 conserva número, paciente, concepto, subtotal, impuesto, pago y saldo en los tres puntos de comparación; catálogo y configuración conservados, sin resembrado |
| Disparo de respaldo programado | `schedule:run` ejecutó una tarea vencida del programador Laravel en el entorno aislado. Copia ID4, tipo scheduled, cifrada, 49.832 bytes, verificada por su ID exacto. No equivale a comprobar el servicio del programador de Windows después de reiniciar |
| Respaldo y restauración | Evidencia anterior real: copia manual desde UI, copia scheduled cifrada/verificada por ID y restauración MariaDB aislada con conteos/importes, 42 tablas y dos triggers. Frase incorrecta y paquete corrupto rechazados. No se atribuye restauración a otra copia |

El EXE histórico `.2` se compiló con Inno Setup 6.5.4. Tiene **102.275.029 bytes** y SHA-256 `e7c63bc930379855fdc4dbd0a45da7abda9a64590354cd38d49bd0078a5b9115`, confirmado de nuevo sobre el archivo entregado. Manifiesto SHA-256 `76543125fd7d75a9853949f607dfd17baad3382ba92c16ddf9f27dd078492f60`; identidad de contenido `2026.09.28.2-3ecd1aa7e091`. El instalador anterior queda como historial. Los procesos MariaDB/PHP/Caddy del ensayo fueron detenidos y sus credenciales temporales retiradas.

## Archivos de comprobación

- [Guía breve de instalación, actualización y recuperación](GUIA_UNA_COMPUTADORA.md).
- [Inventario de rutas, capturas y límites](evidencia/REDISENO-INTEGRAL-20260928/INVENTARIO.md).
- [Revisión visual y correcciones](evidencia/REDISENO-INTEGRAL-20260928/REVISION_VISUAL.md).
- [Resumen actual](evidencia/REDISENO-INTEGRAL-20260928/capturas/01-resumen.png).
- [Cuenta y total móvil](evidencia/REDISENO-INTEGRAL-20260928/capturas/m02b-cobrar-cuenta-total.png).
- [Inspección final de documentos reales](evidencia/REDISENO-INTEGRAL-20260928/financiero/RESULTADO-INSPECCION-FINANCIERA.md).
- [Comprobante PDF con cantidad 1.001](evidencia/REDISENO-INTEGRAL-20260928/financiero/qa-comprobante-mil-uno.pdf).
- [Reporte PDF final](evidencia/REDISENO-INTEGRAL-20260928/financiero/qa-reporte-ejecutivo.pdf).
- [Reporte Excel final](evidencia/REDISENO-INTEGRAL-20260928/financiero/qa-reporte-ejecutivo.xlsx).
- [Corte anterior inspeccionado y conservado](evidencia/REDISENO-INTEGRAL-20260928/documentos-corte-inspeccionado/RESULTADO-INSPECCION-DOCUMENTOS.md).
- [Contratos nativos](evidencia/REDISENO-INTEGRAL-20260928/native/native-contracts-final.log).
- [Resultado del instalador y hashes](evidencia/REDISENO-INTEGRAL-20260928/native/native-release-result.json).
- [Actualización, conservación financiera y recuperación](evidencia/REDISENO-INTEGRAL-20260928/native/native-upgrade-sandbox.json).
- [Recorrido financiero final](evidencia/REDISENO-INTEGRAL-20260928/playwright-financiero.log) y [cierre conciliado](evidencia/REDISENO-INTEGRAL-20260928/financiero/qa-cierre-conciliado.json).

## Límites explícitos

Los datos y operaciones de QA son sintéticos. Los recorridos visuales bloquean solicitudes externas; esto comprueba uso local, no un corte físico de internet. El viewport móvil de 520 px representa espacio reducido, no un teclado nativo. Los estados sin datos o permisos necesarios figuran en el inventario como no recorridos.

No se ejecutó el instalador en un Windows limpio con elevación/UAC, registro real de servicios, apertura al iniciar sesión ni reinicio del equipo; tampoco impresión física. El ensayo usa procesos reales aislados y no certifica esos pasos del equipo de destino. El ejecutable no tiene firma Authenticode. Estas comprobaciones son necesarias antes de considerarlo certificado para la puesta en servicio hospitalaria.







