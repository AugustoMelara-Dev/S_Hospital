# S_Hospital v2 — web

SPA de caja hospitalaria (React 19 + TypeScript estricto + Vite + Tailwind 4).
Contrato: `docs/SPEC.md` y `docs/TERMINOLOGIA.md`. Funciona 100 % offline (fuentes empaquetadas, sin CDN).

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Vite en :5173, proxy `/api` → `http://127.0.0.1:8000` (cambiar con `SHS_API_PROXY=http://host:puerto`) |
| `npm run build` | `tsc -b` + build a `web/dist` (la API lo sirve en `/`) |
| `npm run preview` | Sirve el build |
| `npm run typecheck` / `lint` / `test` | Quality gate (los cuatro deben pasar) |
| `npm run e2e` | Playwright (`e2e/`; instale navegadores con `npx playwright install chromium`) |

## Estructura

```
src/
  api/        types.ts (entidades SPEC §4/§6 + etiquetas), queryClient.ts (qk: query keys compartidas)
  app/        App, routes.tsx (rutas + guards), nav.ts (barra lateral / paleta)
  auth/       AuthProvider, hooks (useAuth, useMe, usePermissions), guards (RequireAuth, RequirePermission, Can)
  features/   <área>/<Página>.tsx — UNA carpeta por agente de funcionalidad
  lib/        api.ts, money.ts, dates.ts, theme.ts, cn.ts
  pages/      Login, Cambiar clave, 404
  shell/      AppShell, Sidebar, TopBar, CashStatusPill (useCurrentCashSession), CommandPalette
  styles/     tokens.css (tokens SPEC §7, claro/oscuro), index.css (tema Tailwind + utilidades)
  test/       setup.ts, mockApi.ts, render.tsx
  ui/         componentes del sistema de diseño (importar desde '@/ui')
```

## Convenciones para agentes de funcionalidad

- Edite solo `src/features/<su área>/`. Reemplace el stub conservando el `export default`.
  Si necesita un componente genérico nuevo, propóngalo; no duplique los de `src/ui`.
- Importe con alias `@/`. Componentes: `import { Button, DataTable, Money, MoneyInput } from '@/ui'`.
- Utilidades de color Tailwind mapeadas a tokens: `bg-surface`, `bg-surface-2`, `border-line`, `text-ink-2`,
  `text-brand`, `bg-brand-soft`, `text-danger`, `bg-ok-soft`… Montos y números de documento: clase `num`
  (mono + cifras tabulares) o `<Money cents={…} />`. Controles de formulario: clase `control`.
- Copia en español exactamente como `docs/TERMINOLOGIA.md`.

### API

```ts
import { api, downloadFile, newIdempotencyKey, errorMessage, isApiError } from '@/lib/api';

const page = await api.get<Paginated<Invoice>>('/invoices', { search, status, page });   // query sin vacíos
await api.patch(`/services/${id}`, { price_cents, reason });                              // X-Requested-With automático

// [IDEM]: genere la clave UNA vez por intento de operación y reutilícela en reintentos.
const key = useRef(newIdempotencyKey());
await api.post<CreatePaymentResponse>(`/invoices/${id}/payments`, body, { idempotencyKey: key.current });
// o, si no hay reintento manual: { idempotent: true }

await downloadFile(`/receipts/${id}/pdf`);                       // PDF → pestaña nueva (llamar en el click)
await downloadFile('/reports/summary.xlsx', { query, mode: 'save' });
```

Errores: `ApiError { status, code, message, fields }` (mensaje ya en español). 401 → `/login`;
403 `password_change_required` → `/cambiar-clave` (automático). Use `errorMessage(e)` para toasts y
`e.fields` para errores por campo.

Query keys compartidas en `qk` (`@/api/queryClient`). Tras cobrar/abrir/cerrar caja invalide
`qk.currentCash` para refrescar el estado de caja de la barra superior.

### Dinero y fechas

```ts
formatCents(123400)          // "L 1,234.00"; null → "No disponible" (nunca L 0.00)
parseMoneyToCents('1,234.5') // 123450 (sin floats); inválido → null
centsToInput(123450)         // "1,234.50"
parseQuantityToHundredths('1.5') // 150 ;  formatHundredths(150) → "1.5"
formatRateBp(1500)           // "15 %"
formatDateTime(iso)          // "17/11/2026 07:02" en America/Tegucigalpa ; todayISO() → "2026-11-17"
```

`<MoneyInput value={cents|null} onValueChange={setCents} />` emite centavos enteros.

### Permisos

```tsx
const { can } = usePermissions();      // can('invoices.void') o can(['reports.own','reports.all']) (cualquiera)
<Can perm="invoices.reverse"><Button>Revertir</Button></Can>
```

### Atajos globales

`Ctrl+K` paleta · `F2` navega a `/cobrar` con `location.state = { focus: 'patient', at }` y emite
`window` event `shs:new-operation` (`NEW_OPERATION_EVENT` en `@/shell/AppShell`) para que Cobrar
reinicie y enfoque "Nombre del paciente" aunque ya esté montada. `F4` (cobrar) es local de la página.

## Pruebas

Vitest + Testing Library, archivos `*.test.ts(x)` junto al código.

```tsx
import { mockApi, makeMe, reply, apiError } from '@/test/mockApi';
import { renderWithProviders, renderApp } from '@/test/render';

const api = mockApi({
  'GET /auth/me': makeMe({ role: { code: 'cajero', name: 'Caja' }, permissions: ['invoices.create'] }),
  'GET /invoices/:id': ({ params }) => ({ id: Number(params.id) /* … */ }),
  'POST /invoices': ({ body, headers }) => reply(201, { /* Invoice */ }),
  'POST /invoices/:id/void': apiError(400, 'invoice_has_payments', 'La factura tiene pagos.'),
});
renderWithProviders(<CobrarPage />, { path: '/cobrar' });   // o renderApp('/cobrar') con todas las rutas
expect(api.calls('POST /invoices')[0]?.headers['idempotency-key']).toBeDefined();
expect(api.unmatched).toEqual([]);
```

Los mocks se restauran tras cada prueba (`vi.restoreAllMocks`).
