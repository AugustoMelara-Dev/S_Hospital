# Handoff Report — Frontend Codebase & UI Surveyor

**Type**: Hard Handoff (Investigation & Survey Complete)  
**Agent**: Frontend Codebase & UI Surveyor (`explorer_survey_frontend`)  
**Date**: 2026-09-28T04:15:00Z  
**Target Recipient**: Parent Orchestrator (`afa577c2-4f95-4c65-bb23-5b3900e061e4`)  
**Reference Mandate**: `hospital-ai/MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md`  
**Comprehensive Analysis File**: `c:\Projects\S_Hospital_AI\.agents\teamwork\explorer_survey_frontend\analysis.md`  

---

## 1. Observation

### 1.1 Rutas y Bypass de Autenticación en `src/App.tsx`
- **Archivo**: `src/App.tsx`, líneas 43-58.
- **Código observado**:
  ```tsx
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
  ```
  La verificación de sesión (`useHospitalSession()`, `session.user`) se realiza **después** de este bloque (líneas 60-140), por lo que estas rutas son accesibles sin autenticación.

### 1.2 Caja Promocional de Propuestas en Login
- **Archivo**: `src/features/auth/LoginView.tsx`, líneas 115-138.
- **Código observado**:
  ```tsx
  <div className="mb-4 rounded-xl border border-indigo-200/90 bg-indigo-50/70 p-3 text-xs dark:border-indigo-900/60 dark:bg-indigo-950/30">
    <div className="mb-2 flex items-center justify-between">
      <span className="font-bold text-indigo-950 dark:text-indigo-200">
        Comparación Visual de Cobro:
      </span>
      <span className="rounded bg-indigo-200/60 px-1.5 py-0.5 text-[10px] font-bold text-indigo-900 dark:bg-indigo-900 dark:text-indigo-200">
        Diseño Nuevo
      </span>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <Link
        to="/propuestas/cobrar-a"
        className="rounded-lg bg-indigo-600 px-2 py-1.5 text-center text-xs font-bold text-white shadow-2xs transition-colors hover:bg-indigo-700"
      >
        Propuesta A · Flujo Continuo
      </Link>
      <Link
        to="/propuestas/cobrar-b"
        className="rounded-lg bg-emerald-600 px-2 py-1.5 text-center text-xs font-bold text-white shadow-2xs transition-colors hover:bg-emerald-700"
      >
        Propuesta B · Comanda Táctica
      </Link>
    </div>
  </div>
  ```

### 1.3 Presencia de Artefactos de Laboratorio A/B
- **Archivos**:
  - `src/features/propuestas/PropuestaShell.tsx`: Barra superior con "Laboratorio de Dirección Visual · Fase de Elección", selector A vs B, selector de prueba ("Cuenta con conceptos" vs "Cuenta vacía"), y sidebar simulada con sesión estática "Caja #7 · Abierta" y "Lic. Elena Ramos".
  - `src/features/propuestas/PropuestaSwitcher.tsx`: Componente selector de propuestas.
  - `src/features/propuestas/PropuestaAView.tsx` y `PropuestaBView.tsx`: Tarjetas explicativas de justificación de diseño de más de 30 líneas.

### 1.4 Fugas de Paleta y Uso de Morado/Esmeralda
- **Acento Morado para Gratuidad**:
  - `src/design-system/admin/tokens.css` (línea 55): `--ui-free: #6941c6;`
  - `src/features/cobrar/components/AccountZone.tsx` (línea 162): Checkbox con `accent-[var(--ui-free)]`.
  - `src/design-system/admin/components.tsx` (línea 370): `FreeMedicationBadge` estilizado con `text-[color:var(--ui-free)] border-[var(--ui-free-border)] bg-[var(--ui-free-subtle)]`.
  - `src/features/cobrar/components/cobrarUi.ts` (línea 89): `free: 'border-t-[var(--ui-free)]'`.
- **Acento Verde/Esmeralda como Segunda Marca**:
  - `src/features/resumen/ResumenView.tsx` (líneas 335, 450, 462): Tarjeta de Cobrado y badges con `border-emerald-500/40 bg-emerald-500/[0.04]` y `text-emerald-700`.
  - `src/features/cobrar/CobrarView.tsx` (línea 231): `<span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />`.
- **Valores de Tokens Desalineados en `tokens.css`**:
  - `--ui-paper: #f7f8fa;` (Mandato: `#F8FAFC`)
  - `--ui-ink: #101828;` (Mandato: `#0F172A`)
  - `--ui-ink-soft: #475467;` (Mandato: `#475569`)
  - `--ui-line: #eaecf0;` (Mandato: `#E2E8F0`)
  - `--ui-action-subtle: #eff4ff;` (Mandato: `#EFF6FF`)
  - `--ui-action-active: #1e40af;` (Mandato: `#1D4ED8`)

### 1.5 Ejecución de Pruebas y Scripts de Calidad
- Comando `npm run typecheck` en `frontend/`:
  - **Resultado**: Código de salida 0 (0 errores).
- Comando `npm run check:ui-rules` en `frontend/`:
  - **Resultado**: Código de salida 0 ("UI rules: 400 archivos shadcn conformes").
- Comando `node scripts/check-no-legacy-ui.mjs --mode=strict` en `frontend/`:
  - **Resultado**: Código de salida 1 (`[QUALITY GATE FAILED] modo=strict; 396 archivos; 44 violaciones`).
  - Desglose: 14 violaciones en `LoginView.tsx`, 27 violaciones en `ResumenView.tsx`, 1 en `CobrarView.tsx`, 2 en `components.tsx`.
- Comando `npm run test:clinical` en `frontend/`:
  - **Resultado**: Código de salida 0 (177 tests pasando en 9 archivos de prueba).
- Comando `npx vitest run src/features/cobrar/CobrarView.test.tsx` en `frontend/`:
  - **Resultado**: Código de salida 0 (7 tests pasando).

---

## 2. Logic Chain

1. **Premisa**: El mandato vinculante `MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md` exige:
   - Identidad unificada en Azul y Blanco (`#2563EB`) y neutros fríos (Slate).
   - "Sin verde como segunda marca, sin morado para EPO y sin mezcla de estilos entre módulos".
   - "Retirar de las rutas operativas la barra de Laboratorio de dirección visual, selector A/B, switches de fixtures, tarjetas explicativas".
   - "Excluir del build productivo y de las rutas de entrega el laboratorio y su excepción de autenticación".
   - Adoptar la estructura de cuenta continua de la Propuesta A depurada.
2. **Deducción de Bypasses**: La observación 1.1 y 1.2 demuestra que en `src/App.tsx` y `LoginView.tsx` las rutas de prueba y sus accesos siguen activos y exentos de autenticación, violando la regla de seguridad y entrega operativa.
3. **Deducción de Tokens y Paleta**: Las observaciones 1.4 y 1.5 confirman que los tokens en `tokens.css` y las vistas `ResumenView` y `CobrarView` mantienen clases esmeralda y moradas explícitas, lo cual causó 44 fallos en el script `check-no-legacy-ui.mjs --mode=strict`.
4. **Deducción de Estación de Cobro**: `CobrarView.tsx` cumple con las reglas lógicas (paciente único, cálculo en servidor, steppers con cantidades exactas, reinicio limpio), pero mantiene una partición visual asimétrica (65% Cuenta / 35% Catálogo) en lugar del flujo contable descendente y continuo de la Propuesta A.

---

## 3. Caveats

- **Áreas no modificadas**: Como agente de tipo Explorer, la investigación fue estrictamente de solo lectura. No se modificó ningún archivo de código fuente fuera del directorio de trabajo `.agents/teamwork/explorer_survey_frontend`.
- **E2E Playwright**: No se ejecutaron pruebas de navegador en vivo Playwright completas para evitar consumo innecesario de recursos o escrituras de fixtures en base de datos. Se verificaron todas las pruebas unitarias y de integración de Vitest (`test:clinical` y `CobrarView.test.tsx`).
- **Backend**: La investigación se centró en la interfaz y la integración con contratos API del frontend; los controladores backend de reportes y plantillas Blade fueron inspeccionados por estructura pero su lógica interna pertenece al especialista de backend.

---

## 4. Conclusion

El frontend de `S_Hospital_AI` cuenta con una base de arquitectura moderna, robusta y con tipado estricto, pero presenta **desalineaciones críticas frente al mandato azul y blanco**:
1. El laboratorio de propuestas visuales (A/B) sigue interfiriendo en el flujo normal, proveyendo un bypass de seguridad en `App.tsx` y enlaces en `LoginView.tsx`.
2. Existen 44 violaciones de paleta registradas por `check-no-legacy-ui.mjs`, principalmente por el uso de morado (`--ui-free: #6941c6`) para gratuidades de diálisis y verde esmeralda para cobros e indicadores en `ResumenView`.
3. Los tokens neutros en `tokens.css` deben alinearse a la escala canónica Slate (`#F8FAFC`, `#0F172A`, `#475569`, `#E2E8F0`, `#EFF6FF`).
4. La estación de cobro `CobrarView` requiere consolidar la ergonomía unificada de la Propuesta A, eliminando la separación de catálogo lateral y ofreciendo una búsqueda directa integrada en el libro contable.
5. La moneda en la UI debe formatearse como `"L. 15.00"` con punto abreviado.

---

## 5. Verification Method

Para verificar independientemente estas conclusiones:

1. **Bypass de Autenticación**:
   - Inspeccionar `src/App.tsx` líneas 43-58 mediante `view_file`.
   - Inspeccionar `src/features/auth/LoginView.tsx` líneas 115-138 mediante `view_file`.
2. **Auditoría de Paleta Local**:
   - Ejecutar en PowerShell:
     ```powershell
     cd C:\Projects\S_Hospital_AI\frontend
     npm run check:ui-legacy:strict
     ```
     *Condición de fallo verificada*: Debe arrojar 44 violaciones en `LoginView.tsx`, `ResumenView.tsx`, `CobrarView.tsx` y `components.tsx`.
3. **Verificación de Tipado y Pruebas**:
   - Ejecutar en PowerShell:
     ```powershell
     npm run typecheck
     npx vitest run src/features/cobrar/CobrarView.test.tsx
     ```
     *Condición de éxito verificada*: 0 errores de compilación y 7/7 pruebas unitarias aprobadas.
4. **Verificación de Tokens**:
   - Inspeccionar `src/design-system/admin/tokens.css` líneas 18-60 y constatar `--ui-free: #6941c6` y valores de neutros.

---
*Reporte de Handoff completado y validado.*
