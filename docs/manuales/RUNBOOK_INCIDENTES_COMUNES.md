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
6. [Internet requerido (NO deberia)](#6-internet-requerido)
7. [PC cliente no carga la app](#7-pc-cliente-no-carga)
8. [Cajero ve doble toast de su propia accion](#8-cajero-doble-toast)
9. [Respaldo muestra Error por herramienta local](#9-respaldo-muestra-error-por-herramienta-local)
10. [Sesion cerrada inesperadamente](#10-sesion-cerrada)

---

## 1. Pantalla blanca

**Sintoma:** El navegador muestra pagina en blanco o un circulo
girando indefinido al abrir `http://IP_SERVIDOR`.

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
- 5 intentos fallidos en 15 min -> lockout de 423.
- Usuario inactivo en la base de datos.
- Cambio obligatorio de contrasena no completado.

**Accion inmediata:**
1. Verificar caps lock. Pedir al usuario que escriba su usuario y
   contrasena en un editor de texto plano primero.
2. Si el error es 423, esperar 15 minutos desde el ultimo intento
   o pedir a un supervisor que reactive el usuario desde
   `Usuarios` -> seleccionar -> `Activar`.
3. Si el usuario es nuevo y nunca entro, verificar que tenga
   `must_change_password=true` (es lo correcto) y que conozca la
   contrasena temporal.

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
3. Si la caja quedo "fantasma" (cajero cerro sesion y se fue),
   pedir a un supervisor con `cash.close_any` que la cierre.

**Escalamiento:** Solo si la BD tiene la sesion en estado raro
(`opened_at` valido pero `closed_at=null` y sin pagos). En ese
caso, soporte nivel 2 la corrige con un script que **no se
incluye en este runbook** y que requiere backup previo.

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

## 6. Internet requerido (NO deberia)

**Sintoma:** La app muestra mensajes de "Failed to fetch" o
errores de CORS al cargar scripts externos.

**Causa probable:**
- El navegador del cliente intenta cargar el bundle de Vite dev
  (no el bundle compilado de produccion).
- La URL apunta a un dominio externo en vez de la IP del servidor.

**Accion inmediata:**
1. Verificar la URL en la barra de direcciones: debe ser
   `http://IP_DEL_SERVIDOR:8000`, no `http://localhost:5173`.
2. Si accidentalmente se abrio `localhost:5173`, cerrarlo y abrir
   la IP real.
3. Si la URL ya es la IP del servidor, abrir
   `Informacion del sistema` y verificar el campo
   `runtime.environment.app_url`.
4. Confirmar que `frontend/dist/` existe en el servidor
   (debe haber un `index.html` dentro).

**Escalamiento:** Si `frontend/dist/` falta en el servidor,
reconstruir con `npm run build` dentro de la carpeta `frontend/`.

---

## 7. PC cliente no carga la app

**Sintoma:** Un cajero desde otra PC ve "No se puede acceder al
sitio" o timeout.

**Causa probable:**
- La PC cliente no esta en la misma subred que el servidor.
- El Firewall de Windows del servidor bloquea el puerto 8000
  en el perfil Privado.
- La IP del servidor cambio y el cliente aun tiene la URL vieja.

**Accion inmediata:**
1. Desde la PC cliente, abrir una terminal y hacer
   `ping IP_SERVIDOR`. Si no responde, revisar cable / WiFi.
2. Si ping responde, abrir `http://IP_SERVIDOR:8000/up` en el
   navegador. Si no carga, pedir a soporte revisar la regla de
   firewall del servidor.
3. Si la app cargo antes y dejo de cargar hoy, probablemente la
   IP del servidor cambio. Revisar `qa/IP_CHANGE_NOTICE.txt` en
   el servidor (lo genera `refresh_lan_ip.ps1`).

**Escalamiento:** Si ping responde y el firewall esta abierto
pero la app no carga, capturar un `tracert IP_SERVIDOR` desde la
PC cliente y enviar a soporte nivel 2.

---

## 8. Cajero ve doble toast de su propia accion

**Sintoma:** El cajero emite una factura y ve el toast
"Factura emitida 000-001-01-00000001" cuando el ya sabe que la
emitio.

**Causa probable:** Este incidente estaba reportado y se corrigio
en v1.0.0. El hook `useBroadcastSync` ahora descarta eventos
cuyo `actor_id` coincide con el usuario actual.

**Accion inmediata:**
1. Verificar que la version desplegada sea v1.0.0 o superior.
2. Si la version es correcta y aun se ve el doble toast, pedir
   al cajero que recargue con `Ctrl+Shift+R` (recarga sin cache).

**Escalamiento:** Solo si es un cliente con version vieja que
no se puede actualizar. En ese caso, suprimir el evento a nivel
de proxy inverso.

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
2. Si la contrasena no funciona, ver seccion 2 (lockout).
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
