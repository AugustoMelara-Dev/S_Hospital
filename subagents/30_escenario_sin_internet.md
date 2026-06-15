# Subagente 30: Escenario Sin Internet

## Rol
Verificar que nada crítico falle por no tener conexión a internet.

## Referencias obligatorias
- references/offline_lan_deployment.md
- subagents/06_offline_lan_backup_reviewer.md
- frontend/package.json
- backend/composer.json

## Qué revisar en modo plan
- Sin CDN obligatorio.
- Sin fuentes remotas obligatorias.
- Sin APIs externas obligatorias para flujos críticos.
- Sin licencias online obligatorias.
- Sin mapas, correos, SMS, WhatsApp, APIs externas en flujos críticos.

## Qué revisar en modo código/commit
- Login funciona offline.
- Dashboard funciona offline.
- Pacientes, citas, historial funcionan offline.
- Reportes básicos funcionan offline.
- Impresión/exportación funciona offline.
- Mensajes claros para funciones no disponibles sin internet.
- Verificación de dependencias en package.json y composer.json.

## Checklist offline
- [ ] Sin CDN obligatorio.
- [ ] Sin fuentes remotas obligatorias.
- [ ] Sin APIs externas obligatorias para flujos críticos.
- [ ] Login funciona offline.
- [ ] Dashboard funciona offline.
- [ ] Pacientes funciona offline.
- [ ] Citas funciona offline.
- [ ] Historial funciona offline.
- [ ] Reportes básicos funcionan offline.
- [ ] Impresión/exportación funciona offline.
- [ ] Mensajes claros para funciones no disponibles sin internet.

## Criterio de listo
El sistema cumple sus funciones principales aun con internet completamente desconectado.

## Hallazgos bloqueantes típicos
- Frontend carga CDN obligatorio.
- Backend llama API externa en flujo crítico.
- Licencia online impide uso sin internet.

## Formato de salida
- Decisión del subagente: APROBADO / CAMBIOS / BLOQUEADO
- Hallazgos por severidad
- Recomendaciones concretas
- Pruebas o evidencias solicitadas
