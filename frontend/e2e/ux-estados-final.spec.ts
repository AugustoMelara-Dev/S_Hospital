import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ADMIN, login, writeEvidence } from './identidad-dark-helpers';

// Backend local real. Se alteran únicamente respuestas de lectura para comprobar
// fallos; no se crean respaldos, operaciones ni cierres de caja.
test('estados desconocidos, reintento y ceros confirmados en las rutas reales', async ({ page }) => {
  test.setTimeout(120_000);
  const screenshots = resolve('../hospital-ai/evidencia/UX-REVISION-20260928/capturas');
  mkdirSync(screenshots, { recursive: true });
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1366, height: 900 });
  await login(page, ADMIN);
  const mutations: string[] = [];
  page.on('request', (request) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) mutations.push(new URL(request.url()).pathname);
  });

  let failBackupStatus = true;
  await page.route('**/api/system/status', async (route) => {
    if (failBackupStatus) await route.fulfill({ status: 503, json: { message: 'No se pudo consultar el estado.' } });
    else await route.continue();
  });
  await page.goto('/administracion/mantenimiento/respaldos');
  await expect(page.getByRole('button', { name: 'Crear respaldo', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Reintentar estado', exact: true })).toBeVisible();
  await expect(page.getByText(/Si estaba cobrando/)).toHaveCount(0);
  await expect(page.getByText('Espere a que termine el respaldo pendiente antes de crear otro.', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: resolve(screenshots, 'respaldos-error.png'), fullPage: true });
  failBackupStatus = false;
  await page.getByRole('button', { name: 'Reintentar estado', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Crear respaldo', exact: true })).toBeEnabled();
  await page.screenshot({ path: resolve(screenshots, 'respaldos-recuperado.png'), fullPage: true });
  await page.unroute('**/api/system/status');

  let incompleteCash = true;
  await page.route('**/api/cash-sessions/current?scope=closable', async (route) => {
    const response = await route.fetch();
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.data?.id, 'Debe existir una sesión sintética abierta').toBeTruthy();
    if (incompleteCash) delete body.data.pending_invoice_count;
    await route.fulfill({ response, json: body });
  });
  await page.goto('/caja');
  const pending = page.getByRole('region', { name: 'Trabajo pendiente', exact: true });
  await expect(pending.getByText('No se pudo confirmar el trabajo pendiente', { exact: true })).toBeVisible();
  await expect(page.getByText('Sin pendientes: el turno puede conciliarse.', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: resolve(screenshots, 'caja-datos-incompletos.png'), fullPage: true });
  incompleteCash = false;
  await pending.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.getByText('Sin pendientes: el turno puede conciliarse.', { exact: true })).toBeVisible();
  await expect(page.getByText('No se pudo confirmar el trabajo pendiente', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: resolve(screenshots, 'caja-cero-confirmado.png'), fullPage: true });
  await page.unroute('**/api/cash-sessions/current?scope=closable');

  let failCashOptions = true;
  await page.route('**/api/cash-sessions?per_page=50', async (route) => {
    if (failCashOptions) await route.fulfill({ status: 503, json: { message: 'No se pudo cargar la lista.' } });
    else await route.continue();
  });
  await page.goto('/reportes');
  await page.getByRole('button', { name: /^Filtros/ }).click();
  await expect(page.getByText('Cajeros y cajas no disponibles', { exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Cajero', exact: true })).toBeDisabled();
  await expect(page.getByRole('combobox', { name: 'Cajero', exact: true })).toContainText('No se pudo cargar la lista');
  await page.screenshot({ path: resolve(screenshots, 'reportes-filtros-error.png'), fullPage: true });
  failCashOptions = false;
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Cajero', exact: true })).toBeEnabled();
  await expect(page.getByRole('combobox', { name: 'Cajero', exact: true })).toContainText('Todos');
  await page.screenshot({ path: resolve(screenshots, 'reportes-filtros-recuperados.png'), fullPage: true });
  await page.unroute('**/api/cash-sessions?per_page=50');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: resolve(screenshots, 'reportes-mobile.png'), fullPage: true });
  expect(mutations, 'El recorrido no debe escribir datos de negocio').toEqual([]);
  expect(pageErrors, 'No debe haber fallos de ejecución en la interfaz').toEqual([]);
  writeEvidence('ux-estados-browser.json', {
    status: 'PASS', backend: 'real local; fallos de lectura inyectados y retirados',
    scenarios: ['respaldo desconocido bloqueado y recuperado', 'caja incompleta sin falso cero y reintento real', 'filtros con error y recuperación real'],
    businessMutations: mutations, pageErrors, screenshots,
  });
});
