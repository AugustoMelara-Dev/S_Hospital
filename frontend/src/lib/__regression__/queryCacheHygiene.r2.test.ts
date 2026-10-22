/**
 * R2-QA-01 — Higiene de cache/QueryClient (regresion INDEPENDIENTE de hs-qa).
 *
 * Verifica el COMPORTAMIENTO DEL PRODUCTO de las funciones reales de
 * invalidacion (`src/lib/queryInvalidation.ts`), no un mock:
 *   - catalogo (areas/categorias/servicios y la lista filtrada de servicios,
 *     que es la que lleva el PRECIO) y setup status;
 *   - facturacion (invoices, cash-sessions, dashboard);
 *   - configuracion fiscal/operativa;
 *   - respaldos.
 * Ademas comprueba el aislamiento entre QueryClients y que `clear()` vacia la
 * cache: el cambio de usuario/permisos usa `queryClient.clear()` en
 * `src/app/useHospitalSession.ts` (login/logout -> ninguna consulta previa del
 * usuario anterior sobrevive).
 *
 * Este archivo no modifica produccion ni el contrato moneyContract.r2.
 */
import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import {
  invalidateBackupQueries,
  invalidateBillingQueries,
  invalidateCatalogQueries,
  invalidateSettingsQueries,
} from '../queryInvalidation';

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY, staleTime: 0 } },
  });
}

function seed(client: QueryClient, keys: readonly (readonly unknown[])[]): void {
  for (const key of keys) {
    client.setQueryData(key, { seeded: true });
  }
}

function isInvalidated(client: QueryClient, key: readonly unknown[]): boolean {
  return client.getQueryState(key)?.isInvalidated === true;
}

describe('R2-QA-01 // invalidacion real de catalogo (incluye precios por service.list)', () => {
  it('marca areas/categorias/servicios/setup como invalidados y no toca facturacion ni respaldos', async () => {
    const client = makeClient();
    seed(client, [
      queryKeys.categories.all,
      queryKeys.categories.list(true),
      queryKeys.areas.all,
      queryKeys.areas.list(true),
      queryKeys.services.all,
      // La lista filtrada es la clave que lleva el precio vigente del servicio.
      queryKeys.services.list({}),
      queryKeys.system.setupStatus(),
      queryKeys.invoices.all,
      queryKeys.backups.all,
    ]);

    await invalidateCatalogQueries(client);

    expect(isInvalidated(client, queryKeys.categories.all)).toBe(true);
    expect(isInvalidated(client, queryKeys.categories.list(true))).toBe(true);
    expect(isInvalidated(client, queryKeys.areas.all)).toBe(true);
    expect(isInvalidated(client, queryKeys.areas.list(true))).toBe(true);
    expect(isInvalidated(client, queryKeys.services.all)).toBe(true);
    expect(isInvalidated(client, queryKeys.services.list({}))).toBe(true);
    expect(isInvalidated(client, queryKeys.system.setupStatus())).toBe(true);
    // No debe invalidar dominios ajenos.
    expect(isInvalidated(client, queryKeys.invoices.all)).toBe(false);
    expect(isInvalidated(client, queryKeys.backups.all)).toBe(false);
  });
});

describe('R2-QA-01 // invalidacion real de facturacion', () => {
  it('marca invoices/cash-sessions/dashboard y no configuracion', async () => {
    const client = makeClient();
    seed(client, [
      queryKeys.invoices.all,
      queryKeys.invoices.list({}),
      queryKeys.cashSessions.all,
      queryKeys.cashSessions.current(),
      queryKeys.reports.dashboard(),
      queryKeys.settings.all,
    ]);

    await invalidateBillingQueries(client);

    expect(isInvalidated(client, queryKeys.invoices.all)).toBe(true);
    expect(isInvalidated(client, queryKeys.invoices.list({}))).toBe(true);
    expect(isInvalidated(client, queryKeys.cashSessions.all)).toBe(true);
    expect(isInvalidated(client, queryKeys.cashSessions.current())).toBe(true);
    expect(isInvalidated(client, queryKeys.reports.dashboard())).toBe(true);
    expect(isInvalidated(client, queryKeys.settings.all)).toBe(false);
  });
});

describe('R2-QA-01 // invalidacion real de configuracion y respaldos', () => {
  it('configuracion marca settings/fiscal-sequences/system', async () => {
    const client = makeClient();
    seed(client, [
      queryKeys.settings.fiscal(),
      queryKeys.fiscalSequences.all,
      queryKeys.system.all,
      queryKeys.services.all,
    ]);

    await invalidateSettingsQueries(client);

    expect(isInvalidated(client, queryKeys.settings.fiscal())).toBe(true);
    expect(isInvalidated(client, queryKeys.fiscalSequences.all)).toBe(true);
    expect(isInvalidated(client, queryKeys.system.all)).toBe(true);
    expect(isInvalidated(client, queryKeys.services.all)).toBe(false);
  });

  it('respaldos marca backups/system', async () => {
    const client = makeClient();
    seed(client, [queryKeys.backups.all, queryKeys.backups.list({}), queryKeys.system.all, queryKeys.invoices.all]);

    await invalidateBackupQueries(client);

    expect(isInvalidated(client, queryKeys.backups.all)).toBe(true);
    expect(isInvalidated(client, queryKeys.backups.list({}))).toBe(true);
    expect(isInvalidated(client, queryKeys.system.all)).toBe(true);
    expect(isInvalidated(client, queryKeys.invoices.all)).toBe(false);
  });
});

describe('R2-QA-01 // aislamiento entre QueryClients y clear() en cambio de usuario', () => {
  it('dos clientes no comparten cache', () => {
    const clientA = makeClient();
    const clientB = makeClient();
    clientA.setQueryData(queryKeys.services.all, [{ id: 1, price: '25.00' }]);

    expect(clientA.getQueryData(queryKeys.services.all)).toBeDefined();
    expect(clientB.getQueryData(queryKeys.services.all)).toBeUndefined();
  });

  it('clear() vacia toda la cache (lo que usa useHospitalSession en login/logout)', () => {
    const client = makeClient();
    seed(client, [
      queryKeys.services.all,
      queryKeys.services.list({}),
      queryKeys.invoices.all,
      queryKeys.settings.all,
      queryKeys.system.all,
    ]);
    expect(client.getQueryCache().getAll().length).toBeGreaterThan(0);

    client.clear();

    expect(client.getQueryCache().getAll().length).toBe(0);
    expect(client.getQueryData(queryKeys.services.list({}))).toBeUndefined();
    expect(client.getQueryData(queryKeys.invoices.all)).toBeUndefined();
  });
});
