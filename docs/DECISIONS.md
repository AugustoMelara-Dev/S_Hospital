# Technical Decisions - Hospital Billing OS Offline

## Registro de decisiones

### 2026-05-16 - Backend Laravel API

Decision:

- El backend vivira en `backend/` y sera una API Laravel.

Motivo:

- Laravel ofrece migraciones, validacion, policies, transacciones, jobs/comandos y ecosistema estable para una app administrativa local.

Consecuencia:

- La logica de negocio critica vive en backend, no en React.

### 2026-05-16 - Frontend React + TypeScript

Decision:

- El frontend vivira en `frontend/` y usara React + TypeScript.

Motivo:

- Permite una UI rapida para caja, formularios reutilizables y pruebas de componentes/flujos.

Consecuencia:

- TypeScript estricto sera parte del quality gate.

### 2026-05-16 - MySQL/MariaDB

Decision:

- La base de datos sera MySQL/MariaDB local.

Motivo:

- El sistema debe soportar varios clientes en LAN y concurrencia de caja/facturacion.

Consecuencia:

- No se usara SQLite multiusuario.

### 2026-05-16 - Docker como desarrollo reproducible

Decision:

- Docker Compose se usara para desarrollo reproducible.

Motivo:

- Reduce diferencias entre maquinas al implementar y probar.

Consecuencia:

- Produccion offline LAN no dependera de instalar paquetes desde internet al arrancar. Debe documentarse instalacion local/Windows servidor aparte.

### 2026-05-16 - Produccion offline LAN

Decision:

- Produccion corre en una computadora servidor local y clientes acceden por navegador via IP LAN.

Motivo:

- El hospital debe operar sin internet.

Consecuencia:

- Login, facturacion, pagos, reportes, impresion y backups no pueden depender de SaaS obligatorio.

### 2026-05-16 - Paciente solo nombre

Decision:

- La factura requiere solo `patient_name`.

Motivo:

- El alcance inicial es facturacion hospitalaria, no expediente clinico.

Consecuencia:

- No se implementara historia clinica, citas ni expediente completo en el core inicial.

### 2026-05-16 - Snapshots de factura

Decision:

- `invoice_items` guardara snapshots de categoria, servicio, precio, impuesto, total y regla aplicada.

Motivo:

- Las facturas historicas no deben cambiar si se edita el catalogo.

Consecuencia:

- Reimpresion y reportes historicos usan snapshots.

### 2026-05-16 - DECIMAL(12,2) para dinero

Decision:

- Los montos se guardaran como `DECIMAL(12,2)`.

Motivo:

- Evita errores de floats en dinero y es natural para MySQL/MariaDB.

Consecuencia:

- Backend centraliza calculos, redondeos y persistencia.

### 2026-05-16 - No Supabase/Firebase/SQLite multiusuario

Decision:

- No usar Supabase cloud, Firebase ni SQLite para operacion multiusuario.

Motivo:

- El sistema debe ser offline LAN y controlar datos localmente.

Consecuencia:

- Auth, datos, permisos y backups se implementan en Laravel + MySQL/MariaDB.

### 2026-05-16 - Supervisor y gestion de catalogo

Decision:

- `supervisor` puede gestionar catalogo/precios solo si el hospital lo autoriza mediante el permiso `catalog.manage`.

Motivo:

- Algunos hospitales delegan ajustes operativos de catalogo a supervision, pero editar precios afecta directamente facturacion y caja.

Consecuencia:

- En demo puede estar permitido para mostrar flujo operativo, pero en produccion debe ser configurable. El backend siempre valida `catalog.manage`; pertenecer al rol `supervisor` no basta si el permiso no esta asignado.

### 2026-05-17 - Catalogo inicial desde CSV y snapshots futuros

Decision:

- `catalogo_servicios_inicial.csv` es la fuente autorizada para poblar categorias y servicios iniciales con seeder Laravel idempotente.
- Los servicios guardan precio actual en `DECIMAL(12,2)`, `active` y `special_rule_code`; la regla de Eritropoyetina se identifica por nombre normalizado y usa `ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION`.
- Cambios de servicio, precio y activacion quedan auditados; facturacion futura debera copiar nombre, categoria, precio y regla a snapshots en `invoice_items`.

Motivo:

- El catalogo debe poder corregirse sin alterar facturas historicas y sin depender del CSV en operacion diaria.

Consecuencia:

- Fase 3 no crea facturacion ni `invoice_items`; solo deja el contrato de datos listo para que Fase 4 emita facturas desde snapshots.
