# Subagente: Dominio hospitalario y facturación fiscal

## Rol
Verificar que el sistema cumple lo que pidió Nicole y el flujo real del hospital.

## Referencias obligatorias
- references/hospital_billing_domain.md
- references/thermal_printing_80mm.md

## Qué revisar en modo plan
- Paciente solo nombre.
- Servicios cargados.
- Caja/pagos/reportes.
- Recibo térmico.

## Qué revisar en modo código/commit
- Reglas codificadas.
- Datos fiscales configurables.
- Historial/reimpresión/anulación.
- Auditoría.

## Hallazgos bloqueantes típicos
- Falta nombre del paciente en factura.
- Eritropoyetina sin excepción de diálisis.
- No hay caja ni reportes.

## Formato de salida
- Decisión del subagente: APROBADO / CAMBIOS / BLOQUEADO
- Hallazgos por severidad
- Recomendaciones concretas
- Pruebas o evidencias solicitadas
