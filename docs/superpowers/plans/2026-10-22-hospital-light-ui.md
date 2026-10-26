# Entrega local: interfaz hospitalaria clara

Decisiones del usuario: blanco y azul hospitalario en todo el sistema;
administrador y supervisor pueden agregar servicios y editar precios. Mantener
las cuentas, credenciales, cajas y comprobantes del servidor en uso.

## Cambios y criterios

| Antes | Después | Motivo |
| --- | --- | --- |
| Tema oscuro impuesto por tokens, arranque y portales | Superficies blancas, fondo gris muy claro y azul institucional, incluso con preferencia oscura | Lectura coherente y controles nativos claros |
| Editar oculto y supervisor de solo consulta | Editar precio visible; `catalog.manage` para supervisor | Gestión solicitada sin tocar precios históricos |
| Caja seleccionada obsoleta podía enviarse | Comprobar que siga activa antes de abrir | Error comprensible antes de solicitar apertura |
| Saldo anulado parecía cobrable | Saldo al anular, identificado como histórico | Evitar confusión sin alterar importes |
| Falta de caja durante consulta parecía definitiva | Consultando su caja | Distinguir espera de ausencia |
| Formato personalizado perdía dimensiones en documento | Conservar ancho, alto y orientación | Vista previa y PDF válidos |
| Confirmación de respaldo persistía tras crear | Cerrar al aceptar y mostrar fallos dentro del diálogo | Permitir descarga y reintento sin bloqueo |

## Referencias consultadas

- [NHS: colores](https://service-manual.nhs.uk/design-system/styles/colour):
  texto oscuro, superficies claras y colores semánticos consistentes.
- [NHS: accesibilidad del diseño](https://service-manual.nhs.uk/accessibility/design):
  etiquetas, foco y verificación desde los componentes.
- [GOV.UK: errores de formulario](https://design-system.service.gov.uk/components/error-summary/):
  mensajes visibles y asociados a lo que debe corregirse.

Se usan como criterios de revisión. No se incorporan servicios externos,
dependencias de internet ni una identidad de otra institución.

## Aislamiento y evidencia

QA: `http://127.0.0.1:18472`, MariaDB `sh_ai_f3_fixes_20261022`, backend
y build temporales. Los flujos sintéticos no se ejecutan sobre `18462`.

En `%TEMP%/sh-fixes-20261022`:

- `light-ui.log`: 14 rutas/paneles a 1366 y 390 px, sin desbordamiento,
  errores JavaScript, HTTP 500 ni violaciones detectadas por axe.
- `light-browser-green.log`: nueve escaneos de contraste y estados interactivos;
  incluye preferencia oscura del sistema y almacenamiento anterior.
- `printing-e2e.log`: guardar papel estándar/personalizado, motivo visible,
  previews HTTP 200, PDF real y ausencia de consumo de correlativo en prueba.
- `final-light-typecheck.log`, `final-light-eslint.log`, `final-light-build.log`.
- `release-light.log`: diez escenarios aprobados y un fallo por el diálogo de
  respaldo que no cerraba. `daily-fixed.log`: recorrido afectado repetido y
  aprobado tras corregirlo (1m 30s), incluyendo descarga y cierre conciliado.
- `mock-light.log`: 23 escenarios de interacción aprobados sobre el tema claro.
- `backup-modal-regression.log`: 53 pruebas de respaldos aprobadas, incluidos
  aceptación, error visible, reintento y prevención de duplicación.
- `backup-fixed-typecheck.log`, `backup-fixed-eslint.log`, `backup-fixed-build.log`:
  comprobaciones posteriores al arreglo del diálogo.

Publicación realizada en `http://127.0.0.1:18462`: entrada idéntica al build QA,
siete recursos iniciales y salud HTTP 200; recursos anteriores conservados.
`live-ui-verification.json`: acceso anónimo publicado comprobado en navegador
con preferencia oscura previa, controles y manifest claros, sin errores JS.
Se recargó únicamente PHP, conservando su entorno y Caddy. Sin migraciones ni
seeders sobre la base en uso. Se añadió exclusivamente `catalog.manage` al rol
supervisor. `main-preservation-result.json` confirma igualdad antes/después de
cuentas/credenciales, asignaciones de roles, sesiones de caja, cantidad de
facturas y pagos. Las pruebas financieras permanecieron en la base independiente.

Pruebas focalizadas: tema 14, catálogo frontend 65, permisos backend 31,
precios/histórico 12, documento personalizado 10/156 aserciones, ajustes de
impresión 52, reportes 29, acceso/caja/recibos 34 y usuarios 37.
Estos grupos tienen superposición; no sumarlos como un total único.

## Límites y observaciones

La inspección y las pruebas automatizadas no certifican impresora física ni
restauración de un respaldo. Se comprobó creación, descarga e integridad cifrada.
Un fallo inicial de respaldo no dejó causa técnica recuperable; reintentos
posteriores sí concluyeron. No se declara una corrección de causa desconocida.

Existe API administrativa de auditoría, pero no una pantalla independiente en
la navegación actual. Agregarla sería una mejora posterior de alcance propio.
El laboratorio no prueba instalación como servicio continuo, acceso desde
otro equipo LAN ni concurrencia de varios puestos.
