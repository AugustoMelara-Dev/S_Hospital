# Manual QA checklist

Checklist de verificacion manual para releases de S_Hospital. Ejecutar en LAN
local, sin depender de internet, con base de prueba restaurable.

## 0. Preparacion

- Backend, frontend, MySQL/MariaDB, scheduler y worker levantados en el
  servidor LAN.
- Cliente abre la app por IP local del servidor, por ejemplo
  `http://192.168.1.10`.
- Usuario admin de prueba y usuario cajero de prueba.
- Caja cerrada al inicio.
- Catalogo con al menos 3 servicios: uno gravable, uno exento y
  eritropoyetina L.25.
- Impresora/PDF configurado para Carta, Media carta o A5 como recibo principal.

## 1. Facturacion principal

Objetivo: emitir y cobrar una factura comun en menos de 60 segundos.

1. Iniciar sesion.
2. Verificar que la accion primaria del dashboard es **Nueva factura** cuando
   la caja esta abierta, o **Abrir caja** cuando esta cerrada.
3. Abrir caja con efectivo inicial.
4. Ir a `/billing/new`.
5. Escribir paciente: `Juan Demo`.
6. Buscar `consulta` y agregar 2 servicios.
7. Verificar total destacado e ISV solo para servicios gravables.
8. Click en **Emitir y cobrar**.
9. Metodo **Efectivo**, monto recibido mayor al total y cambio calculado.
10. Confirmar.
11. Verificar modal de exito:
    - botones principales: **Imprimir**, **Nueva factura**, **Ver detalle**;
    - numero de factura;
    - paciente;
    - total;
    - metodo de pago;
    - estado.
12. Imprimir o abrir PDF/recibo.

Criterio de exito: la factura queda pagada, asociada a caja, cajero, metodo de
pago y fecha, sin doble cobro ni necesidad de recargar.

## 2. Eritropoyetina

1. En `/billing/new`, agregar eritropoyetina.
2. Sin marcar receta de dialisis, verificar precio L.25.
3. Con permiso para marcar receta, activar receta de dialisis.
4. Verificar que eritropoyetina queda gratis y otros servicios no se descuentan.
5. Emitir factura de prueba.

Criterio de exito: backend decide totales y la regla no depende solo del
frontend.

## 3. Recibos e impresion

### 3.1 Usuario normal sin `receipt_settings.advanced`

1. Ir a `/settings/institutional-receipts`.
2. Abrir pestana **Papel y copias**.
3. Verificar que NO se ven: `Ancho mm`, `Alto mm`, `Fuente`, `Escala`,
   `Margen sup.`, `Margen der.`, `Margen inf.`, `Margen izq.`.
4. Verificar que SI se ven:
   - selector de papel institucional principal: Carta, Media carta, A5;
   - **Copias**;
   - **Mostrar logo autorizado**;
   - **Espacio para sello/firma**;
   - **Imprimir prueba**;
   - **Guardar perfil**;
   - vista previa.
5. Confirmar que los formatos secundarios de ticket no aparecen en el flujo normal.
6. Imprimir prueba y verificar marca **PRUEBA - SIN VALIDEZ**.
7. Confirmar que la prueba no consume correlativo fiscal.

### 3.2 Soporte con `receipt_settings.advanced`

1. Iniciar sesion con usuario que tenga `receipt_settings.advanced`.
2. Ir a `/settings/institutional-receipts`.
3. Seleccionar perfil `Recibo pequeno personalizado`.
4. Activar/abrir ajustes avanzados.
5. Verificar campos manuales: ancho, alto, fuente, escala y 4 margenes.
6. Cambiar un valor y guardar.
7. Verificar `audit_logs.action = receipt_print_profile.updated`.

### 3.3 Soporte sin permiso

1. Iniciar sesion sin `receipt_settings.advanced`.
2. Confirmar que no aparece el modo soporte tecnico.
3. Intentar por API enviar `width_mm` a
   `PATCH /api/settings/institutional-receipts/print-profiles/{id}`.
4. Verificar respuesta 403 y
   `audit_logs.action = receipt_settings.advanced_denied`.

## 4. Cambio de papel durante turno

Flujo normal:

1. Con caja abierta, ir a `/settings/institutional-receipts`.
2. Cambiar perfil de papel y guardar.
3. Imprimir prueba antes de emitir otra factura.
4. Emitir una factura de prueba y verificar que
   `invoices.receipt_paper_size` coincide con el perfil resuelto.
5. Dejar evidencia en bitacora operativa si el cambio fue real.

Compatibilidad legacy:

1. Enviar `receipt_paper_size` a `PUT /api/settings/fiscal` con caja abierta.
2. Verificar header `Warning: 299 - "...receipt_paper_size..."`.
3. Verificar header `X-S-Hospital-Paper-Size-Warning: mid-shift-change`.
4. Verificar `audit_logs.action = fiscal_settings.paper_size_changed_mid_shift`.

## 5. Caja

### 5.1 Abrir caja

1. Caja cerrada.
2. Accion primaria: **Abrir caja**.
3. Ingresar efectivo inicial L.500.
4. Confirmar.
5. Verificar `audit_logs.action = cash_session.opened`.

### 5.2 Operar durante turno

1. Emitir 2 facturas: una efectivo y una transferencia.
2. Ir a `/cashbox`.
3. Ver resumen por metodo.
4. Ver movimientos de caja.

### 5.3 Cerrar caja

1. Accion primaria: **Cerrar caja**.
2. Revisar resumen del turno.
3. Ingresar efectivo contado.
4. Si contado coincide, cerrar sin motivo obligatorio.
5. Si hay diferencia, motivo minimo 5 caracteres obligatorio.
6. Verificar `audit_logs.action = cash_session.closed`.

## 6. Anulaciones, reversos y reimpresiones

1. Ir a `/invoices`.
2. Buscar factura pagada.
3. Probar **Reversar factura** con motivo menor a 5 caracteres: debe bloquear.
4. Probar con motivo valido: factura queda reversada segun permisos.
5. Probar anulacion de pago cuando aplique:
   - motivo minimo 5 caracteres;
   - `audit_logs.action = payment.voided`;
   - movimiento compensatorio en caja;
   - la factura no se borra.
6. Probar reimpresion con motivo cuando el recibo institucional ya existe.
7. Verificar que reimprimir no muta saldo ni estado de factura.

## 7. Configuracion fiscal

1. Ir a `/settings/fiscal`.
2. Tabs presentes: **Resumen**, **Hospital**, **Numeracion**, **Operativa**,
   **Marca**.
3. Confirmar que no existe selector normal de papel de recibo en fiscal.
4. En **Numeracion**, cambiar CAI, rango o correlativo sin motivo: guardar debe
   bloquearse.
5. Ingresar motivo valido y guardar.
6. Verificar `audit_logs.action = fiscal_sequence.changed_with_reason`.
7. Verificar que la tarjeta de recibos enlaza a
   `/settings/institutional-receipts`.

## 8. Respaldos

1. Ir a `/backups`.
2. Ver alerta **Restauracion no disponible desde la app**.
3. Ver 3 KPIs principales: Ultimo exitoso, Pendientes, Fallidos.
4. Click **Crear respaldo**.
5. Esperar estado `success`.
6. Verificar tabla con fecha, estado, tamano, usuario y descarga.
7. Descargar si el usuario tiene `backups.download`.
8. Confirmar que no aparece accion **Restaurar** ni **Eliminar**.
9. Calcular SHA-256 del archivo descargado y compararlo contra la tabla.

## 9. Usuarios y roles

1. Ir a `/admin/users`.
2. Crear usuario con contrasena debil: formulario/backend rechazan.
3. Crear usuario con contrasena de 12+ caracteres, mayuscula, minuscula,
   numero y simbolo.
4. Intentar desactivar el ultimo admin: UI debe impedir o backend responder 403.
5. Verificar que permisos protegidos no se asignan a usuarios sin permiso de
   administracion correspondiente.

## 10. Reportes

1. Ir a `/reports`.
2. Navegar subrutas visibles segun permisos:
   - `/reports/executive`;
   - `/reports/cash`;
   - `/reports/audit`.
3. Ejecutivo: KPIs, tendencia, top servicios y metodos de pago.
4. Caja: sesiones, cajeros, metodos y diferencias.
5. Auditoria: anulaciones, reversos, cambios de precio/fiscales y respaldos.
6. Exportar en formatos disponibles por pantalla.
7. Verificar archivo con fecha de generacion y usuario cuando aplique.

## 11. Accesibilidad

1. Navegar solo con teclado: Tab, Enter, Esc y flechas.
2. Verificar:
   - skip-link visible al primer Tab;
   - foco visible;
   - modales con focus trap;
   - Esc cierra modales no destructivos;
   - errores de formulario con `role="alert"`.
3. Ejecutar auditoria a11y en:
   - `/dashboard`;
   - `/billing/new`;
   - `/cashbox`;
   - `/catalog`;
   - `/invoices`;
   - `/reports/executive`;
   - `/backups`;
   - `/settings/fiscal`;
   - `/settings/institutional-receipts`;
   - `/admin/users`.

## 12. Responsive minimo

Probar 1366x768 y 1920x1080:

- sin scroll horizontal de pagina completa;
- sidebar colapsable;
- tablas con overflow horizontal interno;
- topbar compacta;
- botones no tapan contenido.

## 13. Offline/LAN

1. Desconectar internet del cliente.
2. Mantener LAN con el servidor.
3. Login, facturacion, pago, impresion, historial, reportes y backups siguen
   funcionando.
4. Verificar que no hay llamadas obligatorias a Supabase, Firebase, SaaS ni
   CDN externo para operar.

## 14. Recibo institucional principal

1. Emitir una factura pagada.
2. Abrir recibo institucional en Carta, Media carta o A5.
3. Verificar:
   - nombre del paciente visible;
   - hospital, RTN y datos fiscales;
   - caja, cajero, metodo de pago y fecha;
   - servicios, subtotal, ISV y total;
   - sin QR;
   - sin codigo de barras;
   - sin codigos internos expuestos.
