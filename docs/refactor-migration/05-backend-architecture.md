# Arquitectura backend verificada

## Límites actuales

Laravel 12 usa Controllers delgados, 66 Form Requests, 49 Actions, 10 Policies explícitas y eventos para cambios de factura, pago y caja. La aplicación no introduce repositorios genéricos ni una capa `Services` vacía: cada Action representa un caso de uso transaccional o una consulta compleja.

Módulos principales:

- facturación: cálculo, reserva fiscal, creación, anulación y reverso;
- caja: apertura, conciliación y cierre;
- pagos: registro y reverso;
- recibos institucionales: snapshot canónico, HTML/PDF, reserva, emisión, anulación y eventos de impresión;
- reportes: hechos financieros, métricas operativas y exportaciones;
- backups: dump, cifrado, checksum, retención y ejecución asíncrona;
- sistema: salud, estado operativo, OpenAPI, errores cliente y auditoría.

## Invariantes técnicos

- Transacciones explícitas en facturas, pagos, caja, recibos y correlativos.
- Policies registradas en `AppServiceProvider`; Form Requests validan y autorizan entradas.
- `App\Support\Money` acepta, almacena y devuelve centavos enteros; la API pública basada en `float` fue eliminada.
- Idempotencia se identifica por usuario+ruta+clave y protege reintentos/doble clic.
- Modelos históricos mantienen snapshots; ninguna factura se recalcula desde el catálogo vigente.
- Lazy loading se impide fuera de producción para detectar N+1 durante pruebas.

## Refactor incremental

Las clases grandes de reportes y estado del sistema sólo se dividirán al encontrar una responsabilidad aislable con pruebas. El tamaño no basta para justificar un cambio de contrato. Las próximas extracciones priorizan consultas puras, formatters de salida y adaptadores PDF/Excel; las Actions transaccionales permanecen como fronteras de aplicación.

