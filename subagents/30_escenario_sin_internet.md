# Subagente 30: Escenario Sin Internet

## Estado de alcance

ACTIVO solo para el sistema hospitalario offline LAN de caja/facturacion.
DEROGADO / NO APLICA cualquier expectativa de validar citas, expediente clinico, HIS/EMR, consulta medica, laboratorio clinico, farmacia clinica, hospitalizacion o portal de pacientes.

## Rol

Verificar que nada critico falle por no tener conexion a internet.

## Referencias obligatorias

- references/offline_lan_deployment.md
- subagents/06_offline_lan_backup_reviewer.md
- frontend/package.json
- backend/composer.json

## Que revisar en modo plan

- Sin CDN obligatorio.
- Sin fuentes remotas obligatorias.
- Sin APIs externas obligatorias para flujos criticos.
- Sin licencias online obligatorias.
- Sin mapas, correos, SMS, WhatsApp o APIs externas en flujos criticos.

## Que revisar en modo codigo/commit

- Login funciona offline.
- Inicio/dashboard funciona offline.
- Nueva factura funciona offline.
- Caja, pagos y recibos funcionan offline.
- Catalogo, historial, reportes, usuarios, configuracion, respaldos y ayuda funcionan offline.
- Impresion/exportacion funciona offline cuando el hardware local esta instalado.
- Mensajes claros para funciones no disponibles sin internet.
- Verificacion de dependencias en package.json y composer.json.

## Checklist offline

- [ ] Sin CDN obligatorio.
- [ ] Sin fuentes remotas obligatorias.
- [ ] Sin APIs externas obligatorias para flujos criticos.
- [ ] Login funciona offline.
- [ ] Inicio/dashboard funciona offline.
- [ ] Nueva factura funciona offline.
- [ ] Caja y pagos funcionan offline.
- [ ] Recibos funcionan offline.
- [ ] Catalogo funciona offline.
- [ ] Historial funciona offline.
- [ ] Reportes funcionan offline.
- [ ] Respaldos funcionan offline con worker/scheduler local.
- [ ] Configuracion, usuarios y ayuda funcionan offline.
- [ ] Mensajes claros para funciones no disponibles sin internet.

## Criterio de listo

El sistema cumple sus funciones principales de caja, facturacion, pagos, recibos, reportes y respaldos aun con internet completamente desconectado.

## Hallazgos bloqueantes tipicos

- Frontend carga CDN obligatorio.
- Backend llama API externa en flujo critico.
- Licencia online impide uso sin internet.

## Formato de salida

- Decision del subagente: APROBADO / CAMBIOS / BLOQUEADO
- Hallazgos por severidad
- Recomendaciones concretas
- Pruebas o evidencias solicitadas
