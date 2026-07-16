# Matriz de aceptación de evidencia visual

Estado de esta ejecución: **12/12 escenarios Playwright aprobados** en 57.0 s.

Comando ejecutado desde `frontend`:

```text
npx playwright test e2e/operational-ux-canonical.spec.ts --reporter=list
```

| Criterio | Estado | Evidencia o límite |
|---|---|---|
| Doce capturas before preservadas | Verificado | `before/originals/manifest.md` registra fuente, dimensiones y SHA-256. |
| Doce capturas after equivalentes y frescas | Verificado | `after/canonical/01-login.png` a `12-settings.png`; hashes en `final-comparison.md`. |
| Mapeo 1:1 de estados | Verificado | Login, dashboard, facturación vacía, resultados, carrito, caja resumen/movimientos/cierre, historial, catálogo entrada/filtrado y configuración. |
| Datos realistas sin placeholders | Verificado | Pacientes con acentos, facturas fiscales, caja #77, pagos en efectivo/transferencia, ISV y eritropoyetina L 25.00. |
| Capturas visualmente revisadas a imagen completa | Verificado | Se inspeccionaron manualmente las 12 before y las 12 after el 15-07-2026; hallazgos residuales están explícitos abajo. |
| Sin overflow horizontal del documento en las 12 capturas | Verificado | Cada llamada a `save()` compara `scrollWidth <= clientWidth` antes de escribir el PNG. |
| Sin endpoint no mockeado | Verificado | `installStrictMockGuard` falla el test ante cualquier `/api/*` inesperado. |
| Sin `console.error`, `pageerror`, request fallido, HTTP 500 inesperado ni warning de deprecación AntD | Verificado | Guard estricto activo en `beforeEach` y comprobado en `afterEach`; la ejecución terminó 12/12 verde. |
| Login sin error rojo durante estado inicial | Verificado | Captura 01 y aserción explícita de ausencia de “Validando credenciales”. |
| Paciente, búsqueda y cuenta visibles juntos en escritorio | Verificado | Captura 03, 1917×1027. |
| Resultados compactos y cuenta persistente | Verificado | Captura 04, cinco resultados visibles junto a la cuenta. |
| Carrito estrecho sin superposición y CTA visible | Verificado | Captura 05, 672×921; drawer con cantidad, totales y CTA. |
| Caja abre en Resumen | Verificado | Captura 06 y aserción `aria-selected=true`. |
| Movimientos sin paginación doble | Verificado visualmente | Captura 07; dos filas de altura natural y sin controles duplicados. |
| Cierre con bloqueos accionables junto al conteo | Verificado | Captura 08. |
| Historial con altura de contenido y una sola paginación | Verificado visualmente | Captura 09. |
| Número fiscal completo visible en Historial | Verificado | Captura 09 regenerada: ambos correlativos se leen completos. |
| Dashboard sin artefactos de lista | Verificado | Captura 02 regenerada: la cola usa iconos semánticos y no muestra ordinales aislados. |
| Catálogo sin métricas que desplacen la tabla | Verificado | Capturas 10 y 11. |
| Configuración con jerarquía H1 única y resumen denso | Verificado visualmente | Captura 12: el contexto de ruta es secundario y “Configuración hospitalaria” es el único H1. |
| Matriz completa 1920, 1600, 1366, 1280, 1024, 768, 390, zoom 125/200 y reflow 320 | Verificado | `frontend/e2e/accessibility.spec.ts` aprobó diez condiciones: siete viewports, equivalentes de zoom 125/200 y reflow 320×720, sin overflow de documento. |
| Teclado, foco visible, Escape y axe en superficies operativas | Verificado | La matriz responsive aprobó navegación por teclado y axe sin violaciones. Dos comprobaciones de contraste quedaron `incomplete` por elementos parcialmente ocultos del sidebar; su contraste calculado fue 16.27:1. Los tests de componentes cubren focus trap, restauración de foco y Escape. |
| PDF Carta, Media Carta, A5, 80 mm, 58 mm y personalizado | Verificado en generación y render | 30 combinaciones de 1, 5, 15, 30 y 60 ítems: 914 aserciones, paginación monótona, contenido único, encabezado repetible e inspección visual de primeras/últimas páginas. Véase `after/receipt-matrix/manifest.md`. |
| Pagos mixtos en recibo institucional | Verificado en Laravel | La cabecera resume `Pagos mixtos (2)` y la tabla conserva fecha, método, monto, referencia o `Sin referencia` y cajero por pago; el total no se atribuye a transferencia ni a otro método individual. |
| Fallback sin recibo institucional | Verificado en Vitest y axe | Se presenta como `COMPROBANTE HISTÓRICO DE FACTURA`, `No institucional`, `Factura No.` y advierte que no asigna correlativo de recibo; no usa el título oficial. |
| CAI, rango y vigencia fiscal | Verificado en ramas positiva y vacía | El snapshot conserva `fiscal_valid_until`; CAI, rango y fecha límite se imprimen cuando existen y el bloque completo se omite cuando los cuatro datos fiscales están vacíos. |
| Desglose de denominaciones al cerrar caja | Verificado extremo a extremo | Backend valida, persiste y audita el desglose; Vitest global pasó 147 archivos/1,127 pruebas y el gate real de navegador cerró una sesión MariaDB con el mismo JSON contado. Evidencia: `after/cashbox-denominations-1366.png`. |
| Migración del desglose en MariaDB 11 | Verificado en instalación limpia | `migrate:fresh --seed --force` terminó completo e incluyó `2026_07_15_000001_add_closing_breakdown_to_cash_register_sessions_table.php`. |
| Integración operativa con MariaDB local | Verificado | En navegador real se ejecutó login, factura, cobro, recibo institucional, PDF, evento de impresión, reporte, arqueo por denominaciones y cierre persistido con diferencia L 0.00. |
| Integración multiusuario en LAN hospitalaria | **Pendiente** | La corrida local servidor/cliente no sustituye una prueba simultánea desde varias computadoras de la LAN del hospital. |
| Impresora física | **Pendiente** | No verificado. |

## Ciclo RED/GREEN focal de recibos

Las siguientes ejecuciones son evidencia complementaria; no modifican ni
reinterpretan las doce capturas canónicas.

### RED observado

- `InstitutionalReceiptPaymentIntegrationTest`: **1 prueba fallida, 6
  aserciones, 2.92 s**. El HTML no contenía `Pagos mixtos (2)` y reducía dos
  pagos a `Transferencia` junto al total de L. 17.25.
- Rama fiscal de `InstitutionalReceiptPdfTest`: **1 fallida, 1 aprobada, 19
  aserciones, 2.67 s**. Faltaba `Fecha límite de emisión`.
- `ReceiptPreview.test.tsx` y `ReceiptPreview.a11y.test.tsx`: **2 fallidas, 15
  aprobadas, 31.15 s**. El fallback aún se titulaba `RECIBO INSTITUCIONAL` y
  conservaba las etiquetas accesibles oficiales.
- Prueba focal de fechas en pagos mixtos del fallback: **1 fallida, 15
  omitidas, 12.63 s**. No existían elementos `time` para los dos pagos.
- La primera corrida de regresión Laravel después del GREEN funcional produjo
  **1 fallida, 28 aprobadas y 521 aserciones, 34.44 s**: media carta con cinco
  servicios ocupaba dos páginas por una fila fiscal adicional. Ese RED de
  maquetación motivó compactar CAI, rango y vigencia en una sola fila.

### GREEN verificado

- En el backend del stack Docker compartido, la corrida conjunta de
  `InstitutionalReceiptPdfTest.php` e
  `InstitutionalReceiptPaymentIntegrationTest.php` terminó en **31 pruebas
  aprobadas y 1,323 aserciones**. `phpunit.xml` fuerza SQLite
  `:memory:`; esta corrida no acredita MySQL/MariaDB ni la LAN real.
- La matriz de páginas repetida después de compactar el bloque fiscal terminó
  en **1 prueba aprobada, 914 aserciones, 13.32 s**. Media carta con cinco
  servicios volvió a una página y se conservaron los límites de los seis
  perfiles documentados en `after/receipt-matrix/manifest.md`.
- Los dos archivos Vitest de `ReceiptPreview` terminaron en **18 pruebas
  aprobadas, 31.98 s**. La prueba final aislada de pago mixto Laravel añadió la
  ausencia explícita de referencia y terminó en **1 prueba, 10 aserciones,
  3.37 s**.
- Pint sobre las acciones/pruebas de recibo y ESLint sobre los tres archivos
  `ReceiptPreview*` terminaron sin errores.

## Ciclo RED/GREEN focal de caja

### RED observado

- `CloseCashSessionDifferenceTest` produjo **2 fallos**: un desglose cuya suma
  no coincidía con el monto contado era aceptado con HTTP 200, y un desglose
  correcto no se persistía.

### GREEN backend y migración real

- `CloseCashSessionDifferenceTest` terminó en **5 pruebas aprobadas y 18
  aserciones**. Cubre diferencia de cierre, rechazo del desglose inconsistente,
  persistencia del desglose correcto y auditoría.
- En MariaDB 11, `php artisan migrate:fresh --seed --force` terminó completo e
  incluyó la migración
  `2026_07_15_000001_add_closing_breakdown_to_cash_register_sessions_table.php`.
  Esta es evidencia real del esquema MariaDB y se mantiene separada de PHPUnit,
  que usa SQLite `:memory:`.

### Frontend global y navegador real

- Vitest global: **147 archivos y 1,127 pruebas aprobadas**.
- E2E mock de caja: **3/3**; cubre diferencia con nota obligatoria, bloqueo por
  recibo faltante y operación responsive de movimientos/cierre.
- Gate real sobre MariaDB: factura, cobro, recibo/PDF, reporte y cierre por
  denominaciones aprobados; `closing_breakdown`, monto contado y estado
  `closed` se comprobaron contra la respuesta persistida.
- La captura `after/cashbox-denominations-1366.png` muestra el conteo real con
  diferencia preliminar L 0.00 y conciliación lista.

## Gates de cierre ejecutados

- Frontend: TypeScript, ESLint, reglas UI, build Vite y presupuesto de bundle aprobados.
- Vitest: **147 archivos y 1,127/1,127 pruebas aprobadas**.
- Node: **4/4** pruebas del manifiesto segmentado y plan E2E aprobadas.
- Playwright mock: shell 4/4, facturación/catálogo/admin 18/18 y recibos/reportes/soporte 27/27; caja adicional 3/3.
- Playwright release con Chrome del sistema: gate operativo MariaDB y RBAC, **2/2**.
- Responsive/axe: diez condiciones requeridas, sin violaciones y sin overflow de documento.
- Backend: PHPUnit completo **879 pruebas, 6,711 aserciones y 13 skips condicionales**; Pint (436 archivos) y PHPStan sin errores.
- Recibos institucionales focales (PDF e integración de pagos): **31 pruebas/1,323 aserciones**; matriz de 30 archivos/914 aserciones e inspección visual renderizada ya registrada.
- MariaDB 11: migración/seed desde cero y flujo operativo real completo aprobados; el reporte persistido está en [`after/mariadb-release-e2e-report.json`](after/mariadb-release-e2e-report.json) y `docker compose config --quiet` también aprobó.

## Límites externos

La impresora física, sus márgenes no imprimibles y la concurrencia desde varias
computadoras de la LAN siguen requiriendo validación en el hospital.

Esta matriz es deliberadamente parcial: registra exactamente lo observado y
probado, sin convertir una captura mockeada en evidencia de integración o de
impresión física.
