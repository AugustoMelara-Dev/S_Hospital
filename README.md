# Sistema de Caja Hospitalaria

Sistema local para caja, facturacion, pagos, reportes, catalogo de servicios, respaldos y recibos institucionales del Hospital San Isidro o del hospital configurado por administracion.

La aplicacion esta pensada para operar sin internet en una red local LAN: una computadora servidor ejecuta la base de datos y los servicios, y las estaciones de caja acceden por navegador usando la IP local del servidor.

## Alcance Operativo

- Caja hospitalaria con apertura, cobro, cierre y diferencias.
- Facturacion con paciente obligatorio, servicios, totales y pagos.
- Recibo institucional imprimible en media carta, carta o A5.
- Reimpresion con motivo y auditoria cuando el usuario tenga permiso.
- Reporte diario para cierre y revision administrativa.
- Respaldos manuales y programados.
- Configuracion fiscal/hospitalaria sin inventar CAI, serie ni rangos legales.

## Principios De Produccion

- No borrar datos de produccion.
- No reiniciar ni eliminar volumenes de base de datos.
- No depender de internet para login, facturacion, reportes o impresion.
- No exponer credenciales ni variables internas al usuario normal.
- Validar numeracion, serie, CAI o talonarios con administracion, Contaduria, SAR o SEFIN antes de operar formalmente.

## Stack

1. Frontend: React + TypeScript + Tailwind CSS.
2. Backend: Laravel API.
3. Base de datos: MySQL/MariaDB local.
4. Despliegue recomendado: servidor local Windows con MySQL/MariaDB y acceso LAN controlado.

## Instalacion Local

Para desarrollo o preparacion tecnica:

```bash
docker compose up -d
docker compose exec backend php artisan migrate --seed
```

Para instalacion operativa en Windows, use `setup.bat`. El instalador levanta los servicios, aplica migraciones seguras y crea el acceso directo:

```powershell
.\setup.bat
```

Despues de instalar, configure un usuario administrador real y valide:

- Datos del hospital.
- Serie y numeracion autorizada.
- Plantilla de recibo.
- Respaldos.
- Impresora.
- Acceso LAN de las estaciones cliente.

## Acceso

Servidor local:

```text
http://127.0.0.1
```

Clientes en red local:

```text
http://IP-DEL-SERVIDOR
```

## Documentacion Para Operacion

Los manuales para personal estan en:

- `docs/manuales/MANUAL_CAJERO.md`
- `docs/manuales/MANUAL_ADMINISTRADOR.md`
- `docs/manuales/GUIA_INSTALACION_OPERATIVA.md`
- `docs/manuales/GUIA_RESPALDOS_Y_RESTAURACION.md`
- `docs/manuales/CHECKLIST_CAPACITACION.md`

## Notas De Seguridad

El sistema es local. La base de datos debe quedar en el servidor del hospital y no debe exponerse innecesariamente a la red. Los respaldos deben copiarse periodicamente a un medio externo seguro.
