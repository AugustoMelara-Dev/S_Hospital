# Runbook - Incidentes Comunes

> Guia rapida "que hacer cuando..." para cajeros, supervisores y
> soporte de primer nivel. Cada seccion sigue el patron:
> **Sintoma -> Causa probable -> Accion inmediata**.

## Indice rapido

1. [Pantalla blanca al abrir el sistema](#1-pantalla-blanca)
2. [Login no acepta contrasena](#2-login-no-acepta-contrasena)
3. [No imprime la factura](#3-no-imprime-la-factura)
4. [Caja no abre / caja duplicada](#4-caja-no-abre)
5. [Respaldo queda en Pendiente](#5-respaldo-queda-en-pendiente)
6. [Internet requerido (NO deberia)](#6-internet-requerido-o-direccion-incorrecta)
7. [PC cliente no carga la app](#7-pc-cliente-no-carga-la-app)
8. [Cajero ve doble aviso de su propia accion](#8-cajero-ve-doble-aviso-de-su-propia-accion)
9. [Respaldo muestra Error por herramienta local](#9-respaldo-muestra-error-por-herramienta-local)
10. [Sesion cerrada inesperadamente](#10-sesion-cerrada-inesperadamente)
11. [Navegador dice "Conexion no es privada"](#11-conexion-no-es-privada)
12. [WebSocket no conecta desde PC cliente](#12-websocket-no-conecta)
13. [HTTPS responde pero el puerto 80 esta abierto](#13-https-ok-pero-puerto-80-abierto)
14. [Pantalla redirige de https a http y se cierra la sesion](#14-redirige-http)

---

## 1. Pantalla blanca

**Sintoma:** El navegador muestra pagina en blanco o un circulo
girando indefinido al abrir la direccion LAN oficial del sistema.

**Causa probable:**
- La aplicacion del servidor no termino de iniciar.
- El servicio web o la base de datos no estan respondiendo.
- El navegador tiene cache de una version vieja.

**Accion inmediata:**
1. Confirmar que la direccion en el navegador sea la direccion LAN
   oficial del servidor, no una direccion de pruebas.
2. Probar la misma direccion desde el servidor. Si abre en el servidor
   pero no en la caja cliente, tratarlo como problema de red local.
3. Presionar `Ctrl+Shift+Supr` y borrar cache del navegador.
4. Si sigue en blanco, usar **Ayuda > Preparar resumen para soporte**
   cuando la pantalla lo permita, o avisar a soporte local con la hora
   exacta y la direccion LAN oficial usada.
5. Soporte local debe revisar el estado de servicios con su guia de
   mantenimiento; el cajero no debe ejecutar comandos en el servidor.

**Escalamiento:** Si despues de 5 minutos la pantalla sigue blanca,
tomar captura de pantalla y enviar el resumen seguro a soporte nivel 2.

---

## 2. Login no acepta contrasena

**Sintoma:** El cajero escribe su contrasena y la app dice
"Credenciales invalidas" o "Cuenta bloqueada".

**Causa probable:**
- Contrasena mal escrita (caps lock).
- Demasiados intentos fallidos recientes.
- Usuario inactivo.
- Cambio obligatorio de contrasena pendiente.

**Accion inmediata:**
1. Verificar caps lock. Pedir al usuario que escriba su usuario y
   contrasena en un editor de texto plano primero.
2. Si la cuenta aparece bloqueada, esperar el tiempo indicado por el
   sistema o pedir a un supervisor que reactive el usuario desde
   `Usuarios` -> seleccionar -> `Activar`.
3. Si el usuario es nuevo y nunca entro, confirmar con el supervisor
   que tenga una contrasena temporal vigente y que complete el cambio
   de contrasena al primer ingreso.

**Escalamiento:** Ninguno si la contrasena es correcta. Si no se
recupera, generar nueva contrasena temporal desde
`Usuarios` -> `Restablecer contrasena`.

---

## 3. No imprime la factura

**Sintoma:** La pantalla de recibo se ve bien, pero al hacer click
en "Imprimir" no sale papel por la impresora o sale en blanco.

**Causa probable:**
- Impresora apagada, sin papel o sin tinta.
- Impresora no es la predeterminada de Windows.
- Tamano de papel incorrecto en la configuracion de la impresora.
- Tamano de papel del recibo no coincide con la impresora real.

**Accion inmediata:**
1. Verificar que la impresora este encendida, con papel y sin
   error luminoso.
2. Abrir `Impresoras y escaneres` de Windows y confirmar que la
   impresora del sistema sea la predeterminada.
3. En el sistema, ir a `Configuracion fiscal` y verificar que el tamano
   del recibo (media carta, carta o A5) coincida con el papel instalado.
4. Probar "Imprimir como PDF" del navegador para descartar problema
   del navegador.

**Escalamiento:** Si la impresora no responde, llenar
`qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` con el error y los
checks del sistema. Reemplazar la impresora o reinstalar el
driver del fabricante.

---

## 4. Caja no abre

**Sintoma:** El cajero intenta abrir caja y la app dice
"Ya tienes una caja abierta" o no deja crear una nueva.

**Causa probable:**
- Caja anterior quedo abierta (cajero cerro sesion sin cerrar caja).
- Otro usuario con el mismo username abrio caja por error.
- Corte de luz durante el cierre dejo la sesion inconsistente.

**Accion inmediata:**
1. Verificar en `Caja` -> `Sesion actual` si realmente hay una
   caja abierta para este cajero.
2. Si la caja existe pero la app no la muestra, refrescar el navegador
   (F5). Si persiste, cerrar sesion y volver a entrar.
3. Si la caja quedo abierta porque el cajero cerro sesion y se fue,
   pedir a un supervisor autorizado que la revise y cierre con motivo.

**Escalamiento:** Solo si el sistema muestra informacion contradictoria
entre la pantalla de caja, historial y reportes. En ese caso, soporte
nivel 2 debe tomar un backup previo y corregir la sesion con un
procedimiento controlado que deje auditoria.

---

## 5. Respaldo queda en Pendiente

**Sintoma:** Un respaldo manual o automatico queda en **Pendiente**
por mucho tiempo y no cambia a **Protegido** ni a **Error**.

**Causa probable:**
- La tarea local que procesa respaldos no esta activa.
- La herramienta local de copia de la base de datos no esta disponible
  en el servidor.
- Disco duro sin espacio.

**Accion inmediata:**
1. Abrir **Respaldos** y confirmar el estado visible:
   **Protegido**, **Pendiente** o **Error**.
2. Si sigue **Pendiente** despues de varios minutos, avisar a
   soporte local. No cierre el navegador ni repita respaldos muchas
   veces seguidas.
3. Revisar espacio disponible en el servidor. Si queda menos de 5 GB,
   liberar espacio o ampliar disco antes de intentar otro respaldo.
4. Usar **Ayuda > Preparar resumen para soporte** y anotar la hora del
   ultimo respaldo pendiente.
5. Soporte local puede revisar la tarea de respaldos del servidor y
   reiniciarla segun la guia de soporte.

**Escalamiento:** Si al reintentar aparece **Error** o no se genera un
respaldo **Protegido**, soporte nivel 2 valida la herramienta de respaldo
en el servidor y documenta el incidente.

---

## 6. Internet requerido o direccion incorrecta

**Sintoma:** La app no carga, muestra que no puede conectarse o parece
pedir internet para abrir.

**Causa probable:**
- La computadora cliente abrio una direccion de pruebas o una direccion
  externa.
- La direccion del servidor cambio.
- El navegador guardo una version vieja de la pagina.

**Accion inmediata:**
1. Confirmar que la direccion en la barra del navegador sea la
   direccion LAN oficial entregada por administracion.
2. No use direcciones de pruebas ni direcciones que digan
   `localhost` en una computadora cliente.
3. Si la direccion LAN oficial no abre, probar desde el servidor. Si
   abre en el servidor pero no en la caja cliente, tratarlo como red
   local.
4. Borrar cache del navegador y volver a abrir la direccion LAN oficial.
5. Preparar resumen seguro desde **Ayuda** si la pantalla lo permite, o
   registrar hora, computadora y direccion usada.

**Escalamiento:** Soporte local debe revisar la direccion publicada del
sistema y confirmar que la instalacion offline este completa antes de
volver a poner cajas a operar.

---

## 7. PC cliente no carga la app

**Sintoma:** Un cajero desde otra PC ve "No se puede acceder al
sitio" o timeout.

**Causa probable:**
- La PC cliente no esta en la misma subred que el servidor.
- La seguridad local del servidor bloqueo la entrada desde la red.
- La IP del servidor cambio y el cliente aun tiene la URL vieja.

**Accion inmediata:**
1. Confirmar que la computadora cliente tenga red local activa.
2. Confirmar que use la direccion LAN oficial entregada por
   administracion.
3. Probar la misma direccion desde el servidor. Si abre en el servidor
   pero no en la caja cliente, tratarlo como problema de red local.
4. Si la app cargo antes y dejo de cargar hoy, avisar a soporte local:
   puede haber cambiado la direccion del servidor.
5. Registrar hora, nombre de la computadora cliente y mensaje visible.

**Escalamiento:** Si otra computadora cliente si carga el sistema,
soporte local debe revisar red de esa caja. Si ninguna computadora
cliente carga, soporte local debe revisar direccion LAN y seguridad de
red del servidor.

---

## 8. Cajero ve doble aviso de su propia accion

**Sintoma:** El cajero emite una factura y ve el aviso
"Factura emitida 000-001-01-00000001" cuando el ya sabe que la
emitio.

**Causa probable:** La computadora cliente esta usando una version vieja
de la pantalla o recibio dos avisos del mismo evento.

**Accion inmediata:**
1. Verificar que la version desplegada sea v1.0.0 o superior.
2. Si la version es correcta y aun se ve el doble aviso, pedir al cajero
   que recargue la pagina sin repetir la factura ni el cobro.
3. Revisar en `Historial` que exista una sola factura emitida para esa
   accion.

**Escalamiento:** Solo si el aviso doble se repite despues de recargar o
si Historial muestra mas de una factura. En ese caso, soporte local debe
recopilar hora, usuario, numero de factura y pantalla afectada.

---

## 9. Respaldo muestra Error por herramienta local

**Sintoma:** En **Respaldos**, un respaldo aparece como **Error** y no
se genera una copia **Protegida**.

**Causa probable:**
- La herramienta local de respaldo de la base de datos no esta lista.
- La tarea de respaldos no pudo usar la herramienta instalada.
- El servidor no tiene espacio suficiente o permisos locales para crear
  la copia.

**Accion inmediata:**
1. No repita respaldos muchas veces seguidas.
2. Revisar **Respaldos** y confirmar si el estado visible es
   **Error**, **Pendiente** o **Protegido**.
3. Revisar espacio libre del servidor. Si queda menos de 5 GB,
   liberar espacio antes de reintentar.
4. Usar **Ayuda > Preparar resumen para soporte** y anotar la hora
   del respaldo con **Error**.
5. Soporte local debe revisar la herramienta de respaldo en el servidor
   usando la guia de soporte.

**Escalamiento:** Si despues de la revision sigue apareciendo **Error**,
soporte nivel 2 valida la herramienta local de copia de base de datos y
documenta el resultado en la evidencia de respaldo/restauracion.

---

## 10. Sesion cerrada inesperadamente

**Sintoma:** El cajero esta trabajando y de pronto lo devuelve al
login. La app dice "Sesion vencida".

**Causa probable:**
- Cambio de contrasena obligatorio no completado.
- Usuario desactivado por un administrador.
- El servidor reinicio y las cookies expiraron.
- La configuracion local de sesiones cambio durante mantenimiento.

**Accion inmediata:**
1. Intentar iniciar sesion de nuevo con la misma contrasena.
2. Si la contrasena no funciona, ver seccion 2.
3. Si funciona, continuar el turno y avisar al supervisor si vuelve a
   ocurrir.
4. Si la sesion se cierra cada pocos minutos, usar
   **Ayuda > Preparar resumen para soporte** y anotar hora, usuario y
   pantalla donde ocurrio.
5. Soporte local debe revisar la configuracion de sesiones y reiniciar
   servicios solo si su guia de mantenimiento lo indica.

**Escalamiento:** Ninguno en operacion normal. Si la sesion se
cierra inmediatamente despues de iniciar, soporte nivel 2 debe validar
la configuracion local de sesiones sin exponer secretos al personal.

---

## 11. Conexion no es privada

**Sintoma:** El navegador muestra "Su conexion no es privada" al
abrir la direccion segura del sistema.

**Causa probable:**
- La PC cliente no reconoce todavia el certificado local del hospital.
- La fecha u hora de la PC cliente esta incorrecta.
- La direccion usada no es la direccion LAN oficial del sistema.

**Accion inmediata:**
1. Verificar fecha y hora de la PC cliente.
2. Confirmar que se esta usando la direccion LAN oficial entregada
   por administracion, no una direccion escrita de memoria.
3. Cerrar y volver a abrir el navegador.
4. Si el aviso continua, no ingresar usuario ni contrasena en esa PC.
5. Pedir a soporte local que revise el certificado instalado para esa
   computadora y deje evidencia del resultado.

**Escalamiento:** Si otras computadoras entran con candado cerrado
pero una PC mantiene el aviso, soporte local debe corregir la confianza
del certificado en esa PC. Si todas fallan, suspender cobros nuevos
hasta que soporte nivel 2 confirme la direccion segura oficial.

---

## 12. WebSocket no conecta desde PC cliente

**Sintoma:** El cajero carga el dashboard pero no recibe avisos
"Factura emitida" cuando otro cajero cobra. El icono de conexion
en la esquina inferior aparece en gris o amarillo.

**Causa probable:**
- La red local esta intermitente.
- El navegador de esa PC bloquea actualizaciones en vivo.
- El servicio de avisos internos requiere revision de soporte.

**Accion inmediata:**
1. No repetir facturas, cobros ni anulaciones para "probar" el aviso.
2. Refrescar la pantalla una vez y confirmar si el historial o el
   reporte se actualiza con la operacion reciente.
3. Confirmar que la PC usa la direccion LAN oficial.
4. Pedir a otro puesto o al supervisor que confirme si ve la misma
   operacion despues de refrescar su pantalla.
5. Preparar resumen seguro desde **Ayuda** con hora, usuario, puesto
   afectado y mensaje visible.

**Escalamiento:** Si solo falla una PC, soporte local revisa red y
navegador de esa computadora. Si fallan varios puestos, soporte nivel 2
debe validar el servicio interno de avisos usando su guia tecnica.

---

## 13. HTTPS OK pero puerto 80 abierto

**Sintoma:** Una herramienta de seguridad o firewall reporta un puerto
no seguro abierto en el servidor, aunque el sistema abre con candado.

**Causa probable:** Esto es **esperado**. El puerto 80 existe
solo para enviar al usuario hacia la direccion segura. No debe usarse
para trabajar en caja.

**Accion inmediata:**
1. Confirmar que el enlace oficial abre con candado cerrado.
2. Confirmar que caja usa siempre la direccion segura oficial.
3. No cambiar accesos directos ni favoritos sin autorizacion de
   administracion.
4. Si el navegador queda en una direccion no segura o muestra una
   pantalla distinta al sistema, detener el uso de esa PC y avisar a
   soporte.

**Escalamiento:** Soporte nivel 2 debe confirmar la redireccion segura
en su guia tecnica. Operacion normal puede continuar si los puestos
trabajan con candado cerrado y direccion oficial.

---

## 14. Pantalla redirige de https a http y se cierra la sesion

**Sintoma:** El cajero entra con la direccion segura, inicia sesion
y despues de un click el navegador cambia a una direccion no segura o
vuelve al login.

**Causa probable:**
- La PC esta usando un enlace viejo.
- El servidor tiene pendiente una revision de direccion segura.
- El certificado local o la configuracion de red fue modificada.

**Accion inmediata:**
1. No continuar cobrando en esa PC hasta corregir el enlace.
2. Abrir nuevamente usando la direccion LAN oficial entregada por
   administracion.
3. Si vuelve a ocurrir, cerrar sesion y avisar al supervisor.
4. Preparar resumen seguro desde **Ayuda** o registrar hora, usuario,
   PC afectada y direccion visible en la barra del navegador.
5. El supervisor debe validar si otra PC entra correctamente con la
   direccion oficial.

**Escalamiento:** Soporte nivel 2 debe revisar la configuracion segura
del servidor sin exponer archivos internos ni secretos al personal.

---

## Cuando todo falla: lista de verificacion de 60 segundos

1. Confirmar que el servidor este encendido y conectado a la red local.
2. Confirmar que la direccion LAN oficial abre desde el servidor.
3. Confirmar que una computadora cliente use la direccion LAN oficial,
   no `localhost`.
4. Confirmar que caja no repita facturas ni cobros mientras el sistema
   no este estable.
5. Preparar resumen seguro desde **Ayuda** o registrar hora, usuario,
   pantalla y mensaje visible si Ayuda no abre.

Si alguno falla, soporte local debe seguir su guia de mantenimiento y
adjuntar la evidencia al registro interno del hospital.
