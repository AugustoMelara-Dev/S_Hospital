# Informe Exhaustivo de Inspección Frontend & UI/UX
**Proyecto**: Sistema de Caja — Hospital General San Isidro  
**Directorio de Trabajo**: `C:\Projects\S_Hospital_AI`  
**Fecha de Inspección**: 2026-09-28T04:15:00Z  
**Inspector**: Frontend Codebase & UI Surveyor (Archetype: Explorer)  
**Documentos de Referencia**:  
- `c:\Projects\S_Hospital_AI\.agents\teamwork\ORIGINAL_REQUEST.md`  
- `c:\Projects\S_Hospital_AI\hospital-ai\MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md`  
- `c:\Projects\S_Hospital_AI\AGENTS.md`  

---

## 1. Resumen Ejecutivo

Se ha realizado una inspección integral de la base de código frontend (`frontend/src/`) del Sistema de Caja del Hospital General San Isidro. El estado general del código presenta una base técnica sólida en TypeScript estricto, React 19, Tailwind CSS v4, TanStack Query y Radix UI, con pruebas automatizadas (`npm run test:clinical`, `CobrarView.test.tsx`) pasando al 100% y cero errores de tipado (`npm run typecheck`).

Sin embargo, la inspección identificó **desviaciones críticas y violaciones severas** frente al mandato vinculante `MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md` y los requerimientos R1-R6:

1. **Bypass Crítico de Autenticación**: En `src/App.tsx`, las rutas de prototipo (`/propuestas/cobrar-a`, `/cobrar-a`, `/propuestas/cobrar-b`, `/cobrar-b`) se interceptan **antes** de verificar la sesión del usuario, permitiendo el acceso libre sin login ni permisos.
2. **Contaminación de Rutas Operativas con el Laboratorio Visual**: La pantalla de login (`LoginView.tsx`) contiene una tarjeta promocional con enlaces A/B; existen componentes de laboratorio (`PropuestaShell.tsx`, `PropuestaSwitcher.tsx`) con barras fijas de "Fase de Elección", sesiones falsas de caja ("Caja #7", "Lic. Elena Ramos") y textos justificativos de diseño.
3. **Fugas de Paleta e Infracciones de Color**:
   - **Morado no autorizado**: El token `--ui-free: #6941c6` se usa en `tokens.css`, `FreeMedicationBadge`, `AccountZone.tsx` (checkbox de diálisis `accent-[var(--ui-free)]`), `cobrarUi.ts` y `styles.css`.
   - **Verde/Esmeralda como segunda marca**: Usado invasivamente en `ResumenView.tsx` (tarjeta de Cobrado `border-emerald-500/40 bg-emerald-500/[0.04]`, Hero de turno activo `bg-emerald-500/10`), en `CobrarView.tsx` (pulsos verdes), y en `PropuestaBView.tsx`.
   - **Desviación de neutros**: En `src/design-system/admin/tokens.css`, el fondo `--ui-paper` está configurado en `#f7f8fa` (en vez de `#F8FAFC`), el texto `--ui-ink` en `#101828` (en vez de `#0F172A`), el texto secundario `--ui-ink-soft` en `#475467` (en vez de `#475569`), y los bordes `--ui-line` en `#eaecf0` (en vez de `#E2E8F0`).
   - El script oficial `npm run check:ui-legacy:strict` falla con **44 violaciones** de paleta local prohibida.
4. **Discrepancia Ergonómica en Cobrar**: Aunque `CobrarView.tsx` implementa reglas de negocio idóneas (validación en servidor, paciente único, cálculo en centavos), la disposición espacial divide la pantalla en 65% Cuenta y 35% Catálogo lateral, alejándose del flujo continuo y unificado tipo voucher de la Propuesta A donde el buscador se integra entre el paciente y el libro contable.
5. **Formateo de Moneda**: El formateador de UI (`formatLempirasUI`) produce `"L 1,234.50"` (sin punto), en desacuerdo con la especificación vinculante que exige símbolo de moneda unido `"L. 15.00"`.

---

## 2. Enrutamiento, Layout y Shell de la Aplicación

### 2.1 Configuración de Rutas Principales (`AppRoutes.tsx` y `adminNavigation.ts`)
La navegación principal está centralizada en `src/navigation/adminNavigation.ts` y montada en `src/AppRoutes.tsx`:

| Ruta | Componente | Permiso Requerido | Propósito |
|---|---|---|---|
| `/` y `/login` | Redirección | Ninguno | Aterriza en `/cobrar` (rol cajero) o `/resumen` (otros) |
| `/resumen` | `ResumenView` | Autenticado | Balance del día, KPIs operativos y operaciones recientes |
| `/cobrar` | `CobrarView` | `invoices.create`, `catalog.view`, `cash.view`, `payments.create`, `receipts.view` | Estación de cobro, cuenta continua y liquidación |
| `/recibos` | `RecibosView` | `invoices.view` | Historial de facturas, búsqueda, detalle, cobro de saldo y reimpresión auditada |
| `/caja` | `CajaView` | `cash.view` | Turno de caja física, movimientos, desglose por método y arqueo de denominaciones |
| `/reportes/*` | `ReportesView` | `reports.managerial.view` \| `reports.cash_session.view` \| `audit.view` | Reportes de corte, desgloses, exportación PDF y Excel |
| `/administracion/*` | `AdministracionView` | Roles administrativos | Catálogo, usuarios, ajustes de identidad/papel, mantenimiento y ayuda |

### 2.2 Rutas Bypasses y Brechas de Seguridad en `src/App.tsx`
En `src/App.tsx` (líneas 43 a 58), se detectó la siguiente lógica de derivación directa:

```tsx
// src/App.tsx:43-58
function HospitalApp() {
  const location = useLocation();
  const pathname = location.pathname.toLowerCase();
  if (pathname === '/propuestas/cobrar-a' || pathname === '/cobrar-a') {
    return (
      <Suspense fallback={<div className="flex min-h-dvh items-center justify-center"><AdminSpinner className="size-8" /></div>}>
        <PropuestaAView />
      </Suspense>
    );
  }
  if (pathname === '/propuestas/cobrar-b' || pathname === '/cobrar-b') {
    return (
      <Suspense fallback={<div className="flex min-h-dvh items-center justify-center"><AdminSpinner className="size-8" /></div>}>
        <PropuestaBView />
      </Suspense>
    );
  }
  // ... verificación de sesión ocurre DESPUÉS de este bloque ...
```

**Impacto**:
- Cualquier usuario no autenticado que navegue a `/propuestas/cobrar-a`, `/cobrar-a`, `/propuestas/cobrar-b` o `/cobrar-b` visualiza la estación ficticia sin ingresar credenciales.
- Se elude el shell institucional `AdminShell` y el proveedor de contexto `AdminSessionProvider`.

### 2.3 Presencia de Artefactos de Laboratorio y Selectores A/B
- **`src/features/auth/LoginView.tsx` (líneas 115-138)**: Renderiza una caja destacada con borde índigo:
  ```html
  <div className="mb-4 rounded-xl border border-indigo-200/90 bg-indigo-50/70 p-3 text-xs...">
    <span>Comparación Visual de Cobro: Diseño Nuevo</span>
    <Link to="/propuestas/cobrar-a">Propuesta A · Flujo Continuo</Link>
    <Link to="/propuestas/cobrar-b">Propuesta B · Comanda Táctica</Link>
  </div>
  ```
- **`src/features/propuestas/PropuestaShell.tsx`**: Contiene:
  - Header de laboratorio: "Laboratorio de Dirección Visual · Fase de Elección".
  - Barra de cambio de propuesta A vs B con fondos índigo y esmeralda.
  - Conmutador de estado de prueba: "Cuenta con conceptos" vs "Cuenta vacía".
  - Sidebar falsa completa con sesión hardcodeada: "Caja #7 · Abierta", fondo L. 1,000.00, cajera "Lic. Elena Ramos".
- **`src/features/propuestas/PropuestaAView.tsx` y `PropuestaBView.tsx`**:
  - Ambas vistas contienen banners explicativos de diseño ("Ficha de la Propuesta") de más de 30 líneas de texto justificativo.
  - Operan sobre colecciones en memoria (`MOCK_SERVICES`, `REPRESENTATIVE_PATIENT`, `createRepresentativeLines`) en lugar del catálogo y API reales.

### 2.4 Arquitectura del Shell (`AdminShell.tsx` y `AdminSidebar.tsx`)
- **Escritorio**: `<aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-[var(--ui-line)] lg:block xl:w-64">`.
  - Muestra nombre institucional (dinámico vía `usePublicBranding`), botón de búsqueda global (Ctrl+K para `CommandPalette`), enlaces de sección con iconos semánticos (`SECTION_ICONS`), widget de estado de caja al pie con indicador visual y saldo inicial, y tarjeta de usuario con iniciales y botón de salida.
- **Móvil**: Header compacto sticky de 56px (`h-[var(--ui-shell-h)]`) con botón hamburguesa (`MenuIcon`), título del hospital y avatar.
- **Cajón Móvil**: Implementado con `@radix-ui/react-dialog` (`DialogPrimitive.Root`, `Portal`, `Overlay`, `Content data-side="left"`).
  - Incluye `onCloseAutoFocus` que devuelve el foco a `mobileNavTriggerRef.current`.
  - Contenedor portaleado con clase `.ui-portal` para preservar variables de foco y tipografía.

---

## 3. Tokens Visuales e Identidad: Azul, Blanco y Neutros

### 3.1 Auditoría de Paleta Canónica vs `tokens.css`

| Token Mandatado | Valor Canónico | Valor Actual en `tokens.css` | Estado / Discrepancia |
|---|---|---|---|
| Acción y selección principal | `#2563EB` | `--ui-action: #2563eb;` | **Conforme** |
| Estado Hover/Pressed | `#1D4ED8` | `--ui-action-hover: #1d4ed8;`<br>`--ui-action-active: #1e40af;` | **Discrepancia leve** (`active` usa `#1E40AF` en lugar de `#1D4ED8`) |
| Superficie principal | `#FFFFFF` | `--ui-surface: #ffffff;` | **Conforme** |
| Fondo general | `#F8FAFC` | `--ui-paper: #f7f8fa;` | **No conforme** (`#F7F8FA` es más grisáceo y opaco que Slate-50 `#F8FAFC`) |
| Texto principal | `#0F172A` | `--ui-ink: #101828;` | **No conforme** (`#101828` es neutral Inter, no Slate-900 `#0F172A`) |
| Texto secundario | `#475569` | `--ui-ink-soft: #475467;` | **No conforme** (`#475467` no es Slate-600 `#475569`) |
| Bordes y separadores | `#E2E8F0` | `--ui-line: #eaecf0;` | **No conforme** (`#EAECF0` no es Slate-200 `#E2E8F0`) |
| Selección suave | `#EFF6FF` | `--ui-action-subtle: #eff4ff;` | **No conforme** (`#EFF4FF` vs Blue-50 `#EFF6FF`) |

### 3.2 Fugas de Morado y Verde en la Interfaz Operativa

#### Acento Morado (Violación Directa de R1 y §2)
El mandato prohíbe taxativamente: *"Sin morado para EPO"*.
Sin embargo, se encontraron los siguientes usos activos:
1. `src/design-system/admin/tokens.css` (líneas 55-57):
   ```css
   --ui-free: #6941c6;
   --ui-free-subtle: #f4f3ff;
   --ui-free-border: #d9d6fe;
   ```
2. `src/design-system/admin/components.tsx` (líneas 362-378):
   - `FreeMedicationBadge`:
     ```tsx
     className="border-[var(--ui-free-border)] bg-[var(--ui-free-subtle)] text-[color:var(--ui-free)]"
     ```
3. `src/features/cobrar/components/AccountZone.tsx` (línea 162):
   - Checkbox de diálisis:
     ```tsx
     className="... accent-[var(--ui-free)] ..."
     ```
4. `src/features/cobrar/components/cobrarUi.ts` (líneas 58-60, 89, 98):
   - Explicitado en comentarios: *"la gratuidad, el morado reservado a la regla del medicamento elegible"*.
   - `STATE_BORDER_TOP.free: 'border-t-[var(--ui-free)]'`.
   - `STATE_TEXT.free: 'text-[color:var(--ui-free)]'`.
5. `src/features/cobrar/components/ResultZone.tsx` (línea 70):
   - `isZero ? 'bg-[var(--ui-free-subtle)] text-[color:var(--ui-free)]' : ...`.
6. `src/features/resumen/ResumenView.tsx` (líneas 452, 472):
   - Ficha de "Gratuito": `bg-purple-500/10 text-purple-700` con `SparklesIcon`.

#### Acento Verde / Esmeralda como Segunda Marca
El mandato prohíbe: *"Sin verde como segunda marca"*.
Sin embargo, `src/features/resumen/ResumenView.tsx` lo utiliza ampliamente como marca secundaria de cobro e ingreso:
1. `ActiveShiftHero`:
   - `border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400`.
2. `AsymmetricMetricCard` (línea 450):
   - `border-2 border-emerald-500/40 bg-emerald-500/[0.04] text-emerald-700`.
   - Badge "Ingresado": `bg-emerald-500/10 text-emerald-700`.
3. `CobrarView.tsx` (línea 231):
   - `<span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />`.
4. `LoginView.tsx` (línea 133):
   - Botón `bg-emerald-600 hover:bg-emerald-700`.

### 3.3 Micro-interacciones y Polish (`better-ui` / `emil-design-eng`)
- **Cifras Tabulares (`tabular-nums`)**:
  - Declarado en `styles.css` (`:where(.tabular-nums, [data-numeric="true"])`) y aplicado en `MoneyText` y tablas contables.
  - **Inconsistencia de Símbolo**: `formatLempirasUI` en `src/lib/money.ts` genera `L 1,234.50` (sin punto). El mandato exige explícitamente `L. 15.00` con el símbolo unido a la cifra.
- **Radio Concéntrico**:
  - Declarado en tokens: `--ui-radius: 6px`, `--ui-radius-control: 8px`, `--ui-radius-panel: 12px`, `--ui-radius-overlay: 14px`.
  - Cumple la fórmula: `outer (12px) = inner (8px) + padding (4px)`.
  - Discrepancia: En `ResumenView.tsx`, `LoginView.tsx` y `PropuestaAView.tsx` se usan clases fijas `rounded-2xl` (16px) y `rounded-xl` rompiendo la coherencia.
- **Escala Táctil (`active:scale-[0.96]`)**:
  - Correctamente implementada en `PRIMARY_BUTTON` y `SECONDARY_BUTTON` dentro de `src/features/cobrar/components/cobrarUi.ts`:
    `enabled:active:scale-[0.96] motion-reduce:active:scale-100`.
  - Discrepancia: En `PropuestaShell.tsx` (líneas 79, 91, 112, 125) y `ResumenView.tsx` (línea 228) se usa `active:scale-[0.97]`.

---

## 4. Estación de Cobro (`Cobrar` / Propuesta A Depurada)

### 4.1 Disposición Espacial y Comparación Arquitectónica

```
Disposición Actual (CobrarView):           Disposición Mandatada (Propuesta A):
┌───────────────────────────┬──────────┐  ┌──────────────────────────────────┐
│ CUENTA (65%)              │ CATÁLOGO │  │ CUENTA CONTINUA (VOUCHER UNIFIC.)│
│ 1. Paciente               │ (35%)    │  │ 1. Nombre del Paciente           │
│ 2. Checkbox Diálisis      │ Buscador │  │ 2. Buscador Directo (Omnibox)    │
│ 3. Tabla de Líneas        │ Categor. │  │    + Accesos Rápidos Catálogo    │
│ 4. Resumen & Acción Cobro │ Lista    │  │ 3. Ajuste Gratuidad Diálisis     │
│                           │ Conceptos│  │ 4. Tabla Continua (Líneas Ledger)│
│                           │          │  │ 5. Resumen Monetario Servidor    │
│                           │          │  │ 6. Botón de Cobro con Importe    │
└───────────────────────────┴──────────┘  └──────────────────────────────────┘
```

**Hallazgos de la Estación Actual**:
- `CobrarView.tsx` implementó una estación dividida en dos columnas: `xl:grid-cols-[minmax(0,1fr)_380px]`. La cuenta a la izquierda y el catálogo de inserción a la derecha.
- En la Propuesta A original depurada, la búsqueda y adición es un paso integrado verticalmente dentro del propio documento continuo (Omnibox entre el paciente y el libro contable).

### 4.2 Campo de Paciente
- En `PatientZone.tsx`: Único campo solicitado: `Nombre del paciente`.
- Validación estricta mediante Zod (`cobrarPatientSchema`): mínimo 2 caracteres, máximo 400.
- No solicita DNI, expediente clínico, teléfono ni diagnóstico, cumpliendo rigurosamente la regla de negocio.

### 4.3 Búsqueda de Servicios y Comportamiento de Teclado
- En `CatalogZone.tsx`: El buscador `AdminSearch` admite texto por nombre o código interno.
- **Tecla Enter**: Al pulsar `Enter` en el buscador, se invoca `onSubmit={first ? onAddFirst : undefined}`, lo que añade el primer resultado visible a la cuenta contable **sin disparar el cobro** (acción completamente reversible y segura).

### 4.4 Stepper y Tabla Contable
- En `AccountZone.tsx`: El stepper de cantidad está compuesto por un botón de decremento (`MinusIcon`), un `<input inputMode="decimal" />` con tipografía tabular, y un botón de incremento (`PlusIcon`).
- Los clics suman o restan exactamente 1 unidad (100 centésimas).
- La entrada manual permite decimales (ej. `0.5`, `2.25`) y valida contra `parseQuantityUnits`. Si es inválida, muestra un mensaje de error accesible y no rompe el cálculo.
- Cada línea muestra:
  - Nombre completo del servicio.
  - Precio unitario secundario: `<MoneyText cents={...} /> c/u`.
  - Etiqueta de gratuidad si aplica: `<FreeMedicationBadge label="Sin cobro por receta" />`.
  - Importe total calculado de la línea.
  - Botón de eliminación con `Trash2Icon`.

### 4.5 Regla de Gratuidad Médica (Eritropoyetina)
- Evaluada por línea mediante `lineIsFree(line)` (`dialysisPrescription === true && service.special_rule_code === ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION`).
- **No se expone el código técnico**: En `AccountZone.tsx`, el texto al cajero es:
  - *"Paciente con receta de diálisis"*
  - *"Aplica solo al medicamento elegible; el resto conserva su precio."*
- **Líneas no elegibles**: Glucosa, hemogramas, consultas u otros medicamentos conservan su tarifa completa.
- **Previsualización del Servidor**: `useCobrarPreview` consulta el backend (`apiClient.previewInvoice`), el cual devuelve la base exenta y el total real.
- **Problema Detectado**: El checkbox utiliza `accent-[var(--ui-free)]` y el badge utiliza el morado `--ui-free`, el cual debe ser sustituido por el azul canónico o un neutral sobrio con indicador textual.

### 4.6 Reinicio y Limpieza de Estado (Nueva Operación)
En `CobrarView.tsx`:
```tsx
function handleNewOperation() {
  emission.reset();
  setLines([]);
  form.reset({ patient_name: '' });
  setSearch('');
  setCategoryId('all');
  setMethod('cash');
  setReference('');
  setConfirmOpen(false);
  setActionError(null);
  window.setTimeout(() => form.setFocus('patient_name'), 0);
}
```
- Limpia todas las líneas de la cuenta (`lines = []`).
- Al quedar `lines` vacío, `hasEligibleMedication(lines)` y `conditionActive(lines)` evalúan automáticamente a `false`.
- El paciente arranca vacío y el foco se devuelve al input de paciente.
- **Cumplimiento**: Una nueva operación inicia 100% limpia, sin paciente heredado ni condición de diálisis preactivada.

---

## 5. Auditoría de Vistas Frente a Requerimientos R1-R6

### 5.1 Acceso y Sesión (Login y Cambio de Clave)
- `LoginView.tsx`: Implementa formulario institucional con usuario y contraseña, visibilidad de contraseña accesible (`data-ui-icon-swap`), detección de Bloq Mayús, temporizador de bloqueo ante intentos fallidos y layout centrado `AuthLayout`.
- **Defecto**: Contiene la caja publicitaria de propuestas visuales (violación R1).
- `PasswordChangeView.tsx`: Formulario para usuarios con `must_change_password: true`, validación de coincidencia y mensaje de estado.

### 5.2 Resumen (`/resumen`)
- Muestra el corte del día vía `reports.getTodayReport()`, distinguiendo facturación emitida, ingresos cobrados, saldo pendiente y operaciones sin cobro.
- Lista de "Atención Prioritaria" (`AttentionNowPanel`) para cajas sin cerrar o inconsistencias.
- Tabla de operaciones recientes con paginación hacia `/recibos` y deep links (`?operacion=<id>`).
- **Defectos**:
  - Uso predominante de acentos esmeralda/verde en lugar de la paleta azul/blanco canónica.
  - La tarjeta de operaciones sin cobro usa violeta (`bg-purple-500/10 text-purple-700`) con `SparklesIcon`.
  - Estructura de Hero promocional que debe simplificarse hacia un resumen administrativo sobrio.

### 5.3 Recibos e Historial de Operaciones (`/recibos` — R3)
- Búsqueda por paciente, número correlativo, rango de fechas, estado de factura (`paid`, `issued`, `cancelled`) y sesión de caja.
- Tabla contable `RecibosTable` con paginación fluida `InvoicePagination`.
- Panel lateral de detalle `RecibosDetailPanel` con deep link `?operacion=<id>`:
  - Muestra desglose de conceptos, precios, cantidades y ajustes.
  - Muestra cobros asociados y saldo pendiente.
  - Permite cobrar saldos pendientes abriendo `PaymentModal`.
  - Botón de reimpresión auditada que exige motivo obligatorio.
  - Anulación y reversión protegidas por permisos (`invoices.void`, `invoices.reverse`) con registro de auditoría.
- Responsive: el panel se muestra lateralmente en pantallas grandes (`xl`) y se apila limpiamente en dispositivos móviles.

### 5.4 Gestión de Caja y Arqueo (`/caja` — R4)
- `CajaView.tsx` delega en `src/features/cash/CashBoxView.tsx`.
- **Apertura de Turno**: Registro de fondo inicial asociado al operador autenticado.
- **Movimientos**: Tabla discriminada de ingresos, cobros, egresos y depósitos con detalle de método de pago (Efectivo, Tarjeta, Transferencia).
- **Arqueo con Conteo Físico**: `CashDenominationCounter.tsx` proporciona conteo estructurado de billetes en Lempiras (500, 200, 100, 50, 20, 10, 5, 2, 1) y centavos/monedas.
  - Diferencia estrictamente:
    1. Efectivo esperado.
    2. Efectivo contado.
    3. Diferencia (sobrante o faltante).
  - Permite conteo deliberado de cero (`isZeroCashCountConfirmed`), distinguiendo un estado "Pendiente de conteo" de un conteo verificado de L. 0.00.
- **Cierre de Caja**: `CloseSessionDialog.tsx` realiza la conciliación y permite imprimir el comprobante de cierre de sesión.

### 5.5 Reportes Operativos, Ejecutivos, PDF y Excel (`/reportes` — R5)
- Distinción rigurosa de fechas: filtro por fecha de emisión, fecha de cobro y corte.
- Presets rápidos de fecha: Hoy, Ayer, Esta Semana, Este Mes, Mes Anterior, Últimos 30 días (validando rango máximo de 92 días).
- Presentación en pantalla: Un solo desglose activo a la vez mediante pestañas (`ReporteResumen`, `Cobros`, `Ventas por Categoría`, `Servicios`, `Gratuidades`, `Auditoría`), evitando sobrecarga visual.
- **Exportación en PDF Ejecutivo**: `reports.downloadExecutivePdf(appliedFilters)` genera el PDF oficial del servidor con cabeceras repetidas y escala de grises.
- **Exportación en Excel (.xlsx)**: `reports.downloadExecutiveExcel(appliedFilters)` genera un libro multi-hoja estructurado con valores numéricos reales (no texto), códigos con ceros preservados y sin fórmulas vulnerables.

### 5.6 Administración (`/administracion` — R6)
- Agrupada en `AdministracionView.tsx` con navegación interna:
  - **Catálogo y Precios**: Productos, servicios, categorías, precios y asignación de regla especial.
  - **Usuarios y Permisos**: Lista de usuarios, asignación de roles, activación/desactivación.
  - **Ajustes Institucionales**: Identidad del hospital, configuración fiscal, CAI, rangos autorizados y configuración de papel de recibo.
  - **Mantenimiento**: Copias de seguridad (respaldo manual, descarga y lista de backups).
  - **Ayuda**: Documentación operativa local.

---

## 6. Motor de Impresión y Comprobantes Convencionales

### 6.1 Perfiles de Papel Convencionales
El archivo `src/modules/receipts/paperPolicy.ts` define los perfiles oficiales para impresoras convencionales y de escritorio:

| Formato | Dimensiones | CSS `@page` en `receipt-print.css` | Uso Recomendado |
|---|---|---|---|
| **Carta vertical** | 215.9 × 279.4 mm (612 × 792 pt) | `size: letter portrait; margin: 0.47in;` | Perfil principal de página completa |
| **Media Carta** | 8.5 × 5.5 in (612 × 396 pt) | `size: 8.5in 5.5in; margin: 0.35in;` | Formato horizontal compacto oficial |
| **Carta horizontal** | 11 × 8.5 in | `size: letter landscape; margin: 0.45in;` | Formato apaisado extendido |
| **A5** | 210 × 148 mm | `size: A5 landscape; margin: 0.3in;` | Estándar métrico compacto |
| **A4** | 210 × 297 mm | `size: A4 portrait; margin: 0.47in;` | Estándar métrico de página completa |
| **Personalizado** | Ancho y alto en mm | `size: auto; margin: 6mm;` | Ajustes institucionales milimétricos |
| **80 mm / 58 mm** | 80 mm / 58 mm continuo | `size: auto; margin: 4mm / 3mm;` | Compatibilidad térmica secundaria |

### 6.2 Reglas de Impresión CSS (`receipt-print.css`)
- `@media print`:
  - Oculta todos los elementos de UI con `.print-hidden { display: none !important; }`.
  - Modos de visibilidad estricta: `body[data-printing-receipt="true"] * { visibility: hidden !important; }`.
  - Aísla la raíz del comprobante: `[data-receipt-print-root] { visibility: visible !important; position: static !important; }`.
- Sin códigos QR, códigos de barras ni publicidad comercial.
- Espacio reservado para firma y sello institucional.

### 6.3 Dualidad de Componentes de Recibo
Se identificaron dos enfoques coexistentes:
1. `src/features/receipts/ReceiptPreview.tsx`:
   - Componente React que renderiza una tabla HTML simulada en el cliente.
   - Contiene la leyenda: *"Documento histórico no institucional. No corresponde a un recibo institucional"*.
2. `src/features/receipts/InstitutionalReceiptPreviewFrame.tsx`:
   - Componente moderno que carga el HTML exacto renderizado por el servidor (`institutionalReceipts.previewHtml(receiptId)`) dentro de un `<iframe>` aislado.
   - Es fiel 1:1 al PDF oficial generado por Laravel DomPDF en el backend.
3. `useCobrarReceiptActions.ts`:
   - Al terminar el cobro en la estación, descarga o abre directamente el PDF institucional generado por el backend (`apiClient.getInstitutionalReceiptPdf`), registrando el evento de impresión con clave de idempotencia (`createClientIdempotencyKey`).
   - Si la ventana emergente es bloqueada o la impresora falla, la factura y el cobro permanecen seguros y confirmados sin duplicar transacciones.

---

## 7. Auditoría de Calidad Técnica y Calidad de Código

### 7.1 Pruebas de Tipado y Reglas de UI
- `npm run typecheck`: **Aprobado con 0 errores** (TypeScript 5.9.3 en modo estricto).
- `npm run check:ui-rules`: **Aprobado** (400 archivos conformes con reglas semánticas shadcn y sin recursos remotos).
- `npm run test:clinical`: **Aprobado** (177 tests pasando en 9 archivos de prueba).
- `npx vitest run src/features/cobrar/CobrarView.test.tsx`: **Aprobado** (7 tests pasando).

### 7.2 Auditoría de Legacy y Paletas Locales (`check-no-legacy-ui.mjs --mode=strict`)
El script falló con **44 violaciones**, inventariadas a continuación:

| Módulo / Archivo | N.° Violaciones | Clases Infractoras Detectadas |
|---|---|---|
| `src/features/auth/LoginView.tsx` | 14 | `border-indigo-200/90`, `bg-indigo-50/70`, `border-indigo-900/60`, `bg-indigo-950/30`, `text-indigo-950`, `text-indigo-200`, `bg-indigo-200/60`, `text-indigo-900`, `bg-indigo-900`, `bg-indigo-600`, `bg-indigo-700`, `bg-emerald-600`, `bg-emerald-700` |
| `src/features/resumen/ResumenView.tsx` | 27 | `border-emerald-500/30`, `bg-emerald-500/10`, `text-emerald-700`, `text-emerald-400`, `bg-emerald-500`, `border-emerald-500/40`, `bg-emerald-950/20`, `border-amber-500/40`, `bg-amber-500`, `bg-amber-950/20`, `text-amber-700`, `text-amber-300`, `bg-purple-500/10`, `text-purple-700`, `text-purple-300`, `border-amber-500/30`, `text-amber-600` |
| `src/features/cobrar/CobrarView.tsx` | 1 | `bg-emerald-500` (pulso en badge de caja abierta) |
| `src/design-system/admin/components.tsx` | 2 | `backdrop-blur-[1px`, `shadow-[var(--shadow-overlay)]` |

---

## 8. Hoja de Ruta Recomendada de Remediación

Para que los agentes de implementación alcancen la conformidad completa con `MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md`, se recomienda ejecutar las siguientes fases:

### Fase 1: Limpieza del Shell y Supresión del Laboratorio
1. **Eliminar bypasses en `src/App.tsx`**: Retirar las líneas 43-58 que interceptan `/propuestas/*` y `/cobrar-a`/`-b`.
2. **Retirar caja de laboratorio en `LoginView.tsx`**: Eliminar las líneas 115-138 con la tarjeta de comparación índigo/esmeralda.
3. **Limpiar rutas de propuestas en `AppRoutes.tsx`**: Retirar la importación lazy y las rutas de `PropuestaAView` y `PropuestaBView`.
4. **Descartar carpeta obsoleta `src/features/propuestas/`** o aislarla fuera del bundle de producción.

### Fase 2: Unificación de Tokens Visuales (Azul y Blanco #2563EB)
1. **Actualizar `src/design-system/admin/tokens.css`**:
   - Ajustar `--ui-paper: #F8FAFC;`
   - Ajustar `--ui-ink: #0F172A;`
   - Ajustar `--ui-ink-soft: #475569;`
   - Ajustar `--ui-line: #E2E8F0;`
   - Ajustar `--ui-action-subtle: #EFF6FF;`
   - Ajustar `--ui-action-active: #1D4ED8;`
2. **Erradicar el morado (`--ui-free`)**:
   - Redefinir la señalización de gratuidad médica utilizando el azul canónico (`#2563EB`) o tonos neutros sobrios con borde estructural y texto claro (`Sin cobro por receta`).
   - Actualizar `FreeMedicationBadge`, `AccountZone.tsx` y `cobrarUi.ts`.
3. **Erradicar el verde esmeralda secundario en `ResumenView.tsx`**:
   - Sustituir los fondos y bordes esmeralda en `ActiveShiftHero` y `AsymmetricMetricCard` por tarjetas blancas estructuradas con bordes `#E2E8F0` y destacados en azul cobalto (`#2563EB`).
4. **Actualizar `formatLempirasUI` en `src/lib/money.ts`**:
   - Cambiar el prefijo de `"L "` a `"L. "` para cumplir con la especificación de símbolo unido `L. 15.00`.

### Fase 3: Alineación Ergonómica de la Estación `Cobrar`
1. Reorganizar la estación `CobrarView` hacia la secuencia ergonómica de la Propuesta A:
   `Paciente → Inserción / Búsqueda Omnibox con accesos rápidos reales → Líneas de Cuenta (Ledger) → Resumen Servidor → Cobro`.
2. Mantener la Cuenta como área de trabajo continua y dominante, eliminando la sensación de dos paneles desconectados.

### Fase 4: Verificación Integral de Calidad
1. Ejecutar `npm run check:ui-legacy:strict` y asegurar 0 violaciones.
2. Ejecutar `npm run typecheck` y la suite de pruebas unitarias y de integración (`npm test`).
3. Verificar la exportación de comprobantes PDF y Excel desde el navegador.

---
*Fin del informe de inspección frontend.*
