# Manual de Usuario - S_Hospital (Sistema de FacturaciÃ³n Local LAN)

Este manual contiene las instrucciones oficiales para el uso, administraciÃ³n y mantenimiento tÃ©cnico de **S_Hospital OS**, un sistema local diseÃ±ado para operar de forma 100% autÃ³noma y offline en redes locales (LAN).

---

## 1. IntroducciÃ³n y Accesos RÃ¡pidos (Shortcuts)

El sistema S_Hospital estÃ¡ diseÃ±ado para agilizar el proceso de cobro en cajas hospitalarias. La interfaz de Punto de Venta (POS) permite operar casi en su totalidad utilizando Ãºnicamente el teclado.

### Combinaciones de Teclas (Shortcuts en POS)

| Atajo | AcciÃ³n en el Sistema |
| :--- | :--- |
| **`F2`** | Abrir modal de cobro / Registrar pago. |
| **`F4`** | Buscar paciente / Cambiar nombre del paciente. |
| **`F8`** | Limpiar venta actual (vaciar carrito). |
| **`Esc`** | Cerrar cualquier ventana modal activa. |
| **`Enter`** | Confirmar selecciÃ³n en campos de bÃºsqueda o formularios. |

### Flujo de Acceso Local LAN
1. Encienda la computadora Servidor.
2. Inicie el servidor web ejecutando el comando de inicio en la computadora principal.
3. Desde las computadoras cliente conectadas al mismo switch/router local, abra Google Chrome e ingrese la URL de red local:
   * **Ejemplo:** `http://192.168.1.15:8000`
4. Inicie sesiÃ³n con su usuario y contraseÃ±a asignados.

---

## 2. Protocolos de AnulaciÃ³n de Facturas

En S_Hospital, **las facturas nunca se eliminan fÃ­sicamente de la base de datos**. Esto asegura el cumplimiento de las auditorÃ­as fiscales y evita fraudes en caja.

### Reglas CrÃ­ticas de AnulaciÃ³n
* **Permiso Requerido:** Solo los usuarios con rol de **Supervisor** o **Administrador** (permiso `invoices.void`) pueden anular facturas.
* **Motivo Obligatorio:** Al anular una factura, el sistema exige ingresar un motivo claro y justificado (mÃ­nimo 10 caracteres).
* **AuditorÃ­a Permanente:** Cada anulaciÃ³n queda registrada en el registro de auditorÃ­a (`audit_logs`) detallando el ID de la factura, el usuario que la anulÃ³, la fecha exacta y el motivo.
* **Impacto en Caja:** El subtotal e impuesto de una factura anulada se restan de los totales de venta, y los pagos asociados se marcan como anulados de manera que no inflen los totales cobrados.

### Procedimiento para Anular una Factura
1. Vaya al menÃº de **Facturas** en el panel de navegaciÃ³n.
2. Localice la factura a anular por su nÃºmero fiscal o nombre del paciente.
3. Haga clic en **Ver Detalle**.
4. Presione el botÃ³n **Anular Factura** (solo visible si tiene rol de supervisor/admin).
5. Ingrese el motivo de la anulaciÃ³n (ej. *"Captura incorrecta de servicio de laboratorio"*).
6. Presione **Confirmar AnulaciÃ³n**. El estado de la factura cambiarÃ¡ a `void` (Anulada).

---

## 3. Apertura, AuditorÃ­a y Cierres de Caja

El control diario de caja se gestiona a travÃ©s de sesiones individuales para cada cajero.

### Flujo Operativo Diario

```mermaid
graph TD
    A[Apertura de Caja con Monto Inicial] --> B[Registro de Facturas y Cobros]
    B --> C[Movimientos de Caja: Entradas/Salidas]
    C --> D[Cierre de Caja: Conteo FÃ­sico]
    D --> E[AuditorÃ­a: Supervisor valida Diferencias]
```

### 1. Apertura de Caja
Antes de emitir cualquier factura, el cajero debe abrir su sesiÃ³n ingresando el efectivo inicial en caja (fondo de caja para cambio).
* **Ejemplo:** `L. 500.00`

### 2. AuditorÃ­a en Tiempo Real
El administrador o supervisor puede auditar el estado de cualquier caja activa desde el panel de reportes de caja:
* **Efectivo Esperado:** `Monto Inicial + Pagos en Efectivo + Entradas de Caja - Salidas de Caja`.
* **Diferencia de Caja:** Al momento de cerrar, el cajero cuenta el dinero real fÃ­sicamente y el sistema calcula automÃ¡ticamente cualquier faltante o sobrante.

### 3. Cierre de Caja
Al terminar el turno:
1. El cajero ingresa al panel de su sesiÃ³n y presiona **Cerrar Caja**.
2. Cuenta fÃ­sicamente el efectivo en caja e ingresa el valor en el campo **Monto de Cierre**.
3. Escribe comentarios si existieron eventualidades y confirma el cierre.
4. El supervisor revisa el reporte consolidado donde se detalla:
   * Total por mÃ©todo (Efectivo, Tarjeta, Transferencia).
   * Diferencia calculada (ej. `L. +0.75` o `L. -5.00`).
   * Listado detallado de movimientos de efectivo.

---

## 4. Respaldos (Backups) y RecuperaciÃ³n ante Desastres

Al ser un sistema offline, **la seguridad de los datos depende enteramente del plan de respaldos local**.

### CreaciÃ³n de Copias de Seguridad (Backups)
El sistema genera archivos `.sql` autocontenidos que comprimen la base de datos completa.

#### A. Desde la Interfaz Web (Panel Admin)
1. Inicie sesiÃ³n como Administrador.
2. Vaya a **ConfiguraciÃ³n** > **Backups**.
3. Presione el botÃ³n **Crear Copia de Seguridad**. El estado se registrarÃ¡ inicialmente como `pending` y cambiarÃ¡ a `success` en pocos segundos.
4. Presione **Descargar** para descargar el archivo de respaldo.
5. **CRÃTICO:** Copie el archivo descargado a una unidad de almacenamiento externa (USB) de forma diaria.

#### B. ProgramaciÃ³n AutomÃ¡tica Diaria
El instalador configura una tarea diaria en el Windows Task Scheduler que corre:
* **Comando:** `php artisan hospital:backup --type=scheduled`
* **Hora:** Todos los dÃ­as a las `23:00` (o la hora configurada).
* **UbicaciÃ³n local:** Los respaldos se guardan en `backend/storage/app/private/backups`.

---

### Procedimiento de RestauraciÃ³n (Restore)

> [!CAUTION]
> **NUNCA ejecute una restauraciÃ³n directa en la base de datos de producciÃ³n sin haberla probado previamente en una base de datos limpia de pruebas.**

#### Paso 1: Verificar Integridad del Backup
Antes de cualquier restauraciÃ³n, obtenga la suma de comprobaciÃ³n del archivo (checksum SHA256) para asegurar que no estÃ© corrupto:
```powershell
Get-FileHash C:\backups\hospital-backup.sql -Algorithm SHA256
```

#### Paso 2: Probar la RestauraciÃ³n en Base Limpia de Pruebas
1. Inicie sesiÃ³n en la consola del servidor MySQL y cree una base de datos vacÃ­a de pruebas:
   ```sql
   CREATE DATABASE hospital_restore_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
2. Restaure el archivo en esta base de pruebas:
   ```powershell
   mysql -u root -p hospital_restore_test < C:\backups\hospital-backup.sql
   ```
3. Modifique el archivo `.env` de pruebas para apuntar a `hospital_restore_test` y corra las pruebas de Laravel para validar que todo estÃ© Ã­ntegro:
   ```powershell
   php artisan test
   ```

#### Paso 3: Restaurar en ProducciÃ³n
Una vez validada la base de pruebas:
1. Active el modo de mantenimiento en la aplicaciÃ³n para bloquear accesos:
   ```powershell
   php artisan down --secret="mantenimiento-clave"
   ```
2. Realice un backup de seguridad final de la base actual antes de tocar nada.
3. Ejecute el restore del backup seleccionado en la base activa (`hospital_billing`).
4. Limpie y regenere la cachÃ© del sistema:
   ```powershell
   php artisan config:cache
   php artisan route:cache
   ```
5. Desactive el modo de mantenimiento:
   ```powershell
   php artisan up
   ```

---

## 5. ActivaciÃ³n de Licencia Offline

Para producciÃ³n multi-usuario LAN, el sistema requiere registrar una licencia comercial offline.

### Estructura del Archivo `license.json`
El archivo de licencia debe ubicarse en la carpeta de almacenamiento de la aplicaciÃ³n:
`backend/storage/app/license.json`

Este archivo contiene la firma digital de validaciÃ³n que valida que los datos no hayan sido alterados localmente:

```json
{
  "licensee": "Clinica y Hospital de Prueba S.A.",
  "rtn": "08011999123456",
  "expires_at": "2027-12-31",
  "signature": "de78fb216cb34ea7205a28b0304859a1122a2bf89ee60731f8b1d8f58b7333a9"
}
```

### Reglas de ValidaciÃ³n de Licencia
1. **Coincidencia de RTN:** El RTN del archivo de licencia debe coincidir exactamente con el RTN configurado en el sistema en **ConfiguraciÃ³n Fiscal**.
2. **Fecha de ExpiraciÃ³n:** El servidor local compara la fecha del sistema con `expires_at`. Si ha expirado, el sistema restringe ciertas funcionalidades administrativas hasta renovar.
3. **Firma Digital (HMAC):** La firma digital se genera utilizando el algoritmo SHA256 con el siguiente formato de payload salado:
   `licensee|rtn|expires_at` firmado con la clave privada interna. Cualquier cambio manual al nombre del hospital o al RTN romperÃ¡ la firma y marcarÃ¡ la licencia como **Firma InvÃ¡lida**.

---

## 6. Soporte TÃ©cnico Local
* **Base de Datos Local:** MariaDB / MySQL en puerto `3306`.
* **Servidor Web LAN:** Apache / Nginx / PHP en puerto `8000`.
* **Logs Operativos:** Revise `backend/storage/logs/laravel.log` ante errores de backend.
