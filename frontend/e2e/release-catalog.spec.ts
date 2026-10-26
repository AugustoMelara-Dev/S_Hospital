import { expect, test } from '@playwright/test';

test.skip(process.env.E2E_RELEASE_ALLOW_MUTATIONS !== '1', 'Requires the isolated release laboratory.');

for (const role of ['admin', 'supervisor']) {
  test(`${role} can add a service and edit its audited price from the catalog`, async ({ page }, testInfo) => {
    const name = `QA catálogo ${role} ${Date.now()}`;
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 500) errors.push(`${response.status()} ${response.url()}`);
    });
    await page.goto('/login');
    await page.locator('#login-input').fill(role === 'admin'
      ? process.env.E2E_RELEASE_ADMIN_LOGIN ?? 'admin.e2e'
      : process.env.E2E_RELEASE_SUPERVISOR_LOGIN ?? 'supervisor.e2e');
    await page.locator('#password-input').fill(process.env.E2E_RELEASE_PASSWORD ?? '');
    await page.getByRole('button', { name: /iniciar sesión/i }).click();
    await expect(page.getByRole('button', { name: /^salir$/i })).toBeVisible();
    await page.goto('/administracion/catalogo');
    await expect(page.getByRole('heading', { level: 1, name: 'Productos y servicios' })).toBeVisible();
    await page.getByRole('button', { name: /crear nuevo producto o servicio/i }).click();
    const createDialog = page.getByRole('dialog', { name: 'Nuevo producto o servicio' });
    await createDialog.getByLabel(/^nombre/i).fill(name);
    const [categoryId] = await createDialog.getByRole('combobox', { name: 'Categoría', exact: true }).selectOption({ index: 1 });
    const [areaId] = await createDialog.getByRole('combobox', { name: 'Área', exact: true }).selectOption({ index: 1 });
    await expect(createDialog.getByRole('combobox', { name: 'Categoría', exact: true })).toHaveValue(categoryId);
    await expect(createDialog.getByRole('combobox', { name: 'Área', exact: true })).toHaveValue(areaId);
    await createDialog.getByLabel(/^precio/i).fill('100.00');
    const created = page.waitForResponse((response) => response.request().method() === 'POST'
      && new URL(response.url()).pathname === '/api/services');
    await createDialog.getByRole('button', { name: /^crear$/i }).click();
    const createResponse = await created;
    expect(createResponse.request().postDataJSON()).toMatchObject({ category_id: Number(categoryId), area_id: Number(areaId) });
    expect(createResponse.status(), await createResponse.text()).toBe(201);
    const service = (await createResponse.json()).data as { id: number; name: string; price: string };
    expect(service).toMatchObject({ name, price: '100.00', category_id: Number(categoryId), area_id: Number(areaId) });
    await expect(createDialog).toBeHidden();

    await page.goto(`/administracion/catalogo?q=${encodeURIComponent(name)}`);
    const row = page.getByRole('row').filter({ has: page.getByText(name, { exact: true }) });
    await expect(row).toContainText('L. 100.00');
    await row.getByRole('button', { name: `Editar precio de ${name}`, exact: true }).click();
    const editDialog = page.getByRole('dialog', { name: 'Editar producto o servicio' });
    await expect(editDialog.getByLabel(/^nombre/i)).toHaveValue(name);
    await editDialog.getByLabel(/^precio/i).fill('125.50');
    // El motivo requerido se descubre al cambiar la tarifa, antes de guardar.
    await editDialog.getByRole('button', { name: /^actualizar$/i }).click();
    await expect(editDialog.getByText('Indique el motivo del cambio de precio.', { exact: true })).toBeVisible();
    await editDialog.getByLabel(/motivo del cambio de precio/i).fill('QA: tarifa autorizada para la prueba de entrega.');
    const updated = page.waitForResponse((response) => response.request().method() === 'PATCH'
      && new URL(response.url()).pathname === `/api/services/${service.id}`);
    await editDialog.getByRole('button', { name: /^actualizar$/i }).click();
    const updateResponse = await updated;
    expect(updateResponse.status(), await updateResponse.text()).toBe(200);
    expect((await updateResponse.json()).data).toMatchObject({ id: service.id, name, price: '125.50' });
    await expect(editDialog).toBeHidden();
    await expect(row).toContainText('L. 125.50');
    await page.screenshot({ path: testInfo.outputPath(`${role}-catalog-price.png`), fullPage: true });
    expect(errors).toEqual([]);
  });
}
