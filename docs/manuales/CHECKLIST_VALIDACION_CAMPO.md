# Paquete de Validación de Campo - S_Hospital

**Estado Objetivo Final:** `FIELD_VALIDATION_READY`

Este documento agrupa los criterios estrictos para validar el sistema S_Hospital directamente en el entorno físico (LAN y Hardware del hospital).

## 1. Instalación en PC/Servidor Local
- [ ] La PC Servidor cumple con requisitos mínimos (Windows/Linux, RAM, Almacenamiento).
- [ ] Docker y Docker Compose instalados y funcionando.
- [ ] Clon del repositorio y `.env` de producción local configurados sin credenciales por defecto.
- [ ] Levantamiento exitoso de contenedores (`docker compose up -d`).
- [ ] Migraciones ejecutadas exitosamente.
- [ ] Acceso local comprobado en el navegador de la PC Servidor a través de `http://localhost`.

## 2. Actualización Segura (Sin Pérdida de Datos)
- [ ] Volcado de base de datos actual antes de actualizar.
- [ ] `git pull` o actualización de imágenes de Docker completada sin errores.
- [ ] Reconstrucción de contenedores (`docker compose up -d --build`).
- [ ] Migraciones nuevas ejecutadas (`php artisan migrate --force`).
- [ ] Verificación de integridad de facturas previas y catálogos de servicios tras la actualización.

## 3. Respaldo (Backup) y Restauración
- [ ] Ejecución de script manual o tarea automática de backup (`php artisan backup:run`).
- [ ] Confirmación de que el archivo `.zip` de respaldo existe en el volumen de almacenamiento (o se descargó correctamente vía web).
- [ ] Descompresión y verificación de la estructura del SQL generado.
- [ ] Prueba de restauración en un entorno limpio simulando desastre (`drop database` y posterior `mysql < backup.sql`).

## 4. Prueba de Red Local (LAN) con Clientes Conectados
- [ ] Firewall de Windows/Linux configurado para permitir tráfico en el puerto HTTP/HTTPS de la aplicación.
- [ ] IP estática o reservada por MAC asignada a la PC Servidor (ej. `192.168.1.10`).
- [ ] Ingreso exitoso al sistema desde al menos 2 PCs Cliente distintas usando la IP del servidor.
- [ ] Pruebas de concurrencia: distintos clientes emitiendo facturas en paralelo sin conflictos de correlativo evidentes ni bloqueos.

## 5. Impresión Física de Recibo Institucional (Prioridad Principal)
> **IMPORTANTE:** La impresión térmica 80mm/58mm queda estrictamente como legacy/opcional. El enfoque operativo es el recibo institucional tradicional.
- [ ] **Impresión Media Carta Horizontal:** Tamaño 5.5" x 8.5" desde navegador, escala estricta al 100%, sin "Ajustar a la página".
- [ ] **Impresión A5 Horizontal:** Validado en navegador, escala 100%, márgenes en "Ninguno" o "Personalizado".
- [ ] **Impresión Carta:** Validado únicamente como formato de respaldo de contingencia por si falta papel especial.
- [ ] **Tamaño Personalizado de SO:** Configurado manualmente en el sistema operativo de la impresora si las hojas de la imprenta del hospital tienen recortes y dimensiones físicas que varían de los estándares.
- [ ] **Comprobación Visual Fina:** Confirmar físicamente que las tablas, bordes y firmas no sufren recortes.

## 6. Configuración Real del Hospital (Parametrización)
- [ ] **Datos Institucionales:** Nombre oficial del hospital, dirección física y RTN ingresados en el panel (`Configuración > Institucional`).
- [ ] **Serie:** Serie fiscal/interna válida configurada y activada.
- [ ] **Rango:** Rango autorizado cargado con sus parámetros de alerta para vencimiento.
- [ ] **Correlativo Inicial:** Siguiente número a facturar establecido según requerimiento oficial de la administración.
- [ ] **Texto Legal:** Descargo legal/fiscal ajustado a la normativa vigente impreso íntegramente al pie del recibo.
- [ ] **Política de Copias:** Impresión de las "x" copias requeridas (Original Cliente, Copia Archivo, Copia Auditoría) en una misma tira de papel o páginas separadas.
- [ ] **Sello y Firma Físicos:** Margen inferior impreso validado con un sello físico de goma del hospital para comprobar el espacio disponible para firma del cajero.
- [ ] **Papel Final:** Desempeño validado usando el papel texturizado/timbrado exacto que usará la institución diariamente.

## 7. Guía Corta para Personal de Caja (Consultas Rápidas)
1. **Emitir Factura y Cobro:**
   - Selecciona servicios filtrando por área clínica o escaneando su código (si existe).
   - Ingresa obligatoriamente el *Nombre del Paciente*. Si corresponde, marca la exención de *Receta de Diálisis* (la vista previa cambiará a L. 0.00).
   - Presiona `Emitir y abrir cobro` o `Confirmar emisión`. Registra el dinero entregado; el sistema calculará el cambio.
2. **Imprimir Recibo:**
   - En la vista previa del recibo, presiona `Ctrl + P`.
   - Revisa que tu navegador indique **Escala: 100% / Tamaño real** y **Márgenes: Ninguno**. No marques la opción de encabezados/pies de página del navegador.
3. **Reimprimir un Recibo (Solo Autorizados):**
   - Ve a `Historial de Facturas`. Selecciona la factura y elige `Imprimir copia`.
   - Se solicitará un *motivo* obligatorio para la auditoría antes de generar el render PDF/Imprimible.
4. **Anular una Factura (Solo Autorizados):**
   - En `Historial de Facturas`, selecciona `Anular factura`.
   - Ingresa el motivo explícito de anulación. El registro no se borra, únicamente se cambia de estado a "Anulada" y libera los montos en el reporte de caja.
5. **Hacer Backup (Fin de Jornada):**
   - Ve a `Configuración > Respaldos` y genera/descarga una copia. Trasládala a una memoria USB de seguridad para su custodia física.

## 8. Reporte de Pendientes de Campo
*Secciones a llenar por el instalador durante la validación física en el hospital.*
- [ ] ¿El papel real utilizado difiere en milímetros de los estándares CSS? *(Medir con regla en sitio y ajustar CSS base si es necesario).*
- [ ] ¿Los navegadores de las PCs cliente soportan el visor PDF moderno o los @page attributes? *(Si no, actualizar Edge/Chrome a última versión).*
- [ ] ¿Se aseguró estáticamente la IP del servidor en el router para evitar desconexiones por DHCP flushing?
- [ ] Observaciones adicionales de hardware: *(Ej. La bandeja manual traba el papel A5, se resolvió asignando bandeja primaria).*

---
**Nota para implementadores:** Este documento es el paso crítico final antes de exponer el sistema a la carga y al paciente real. Su ejecución certificada habilita el paso a *Producción*.
