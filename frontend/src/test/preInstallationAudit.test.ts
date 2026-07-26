import { describe, expect, it } from 'vitest';
import { appRoutes, primaryNavigation } from '@/navigation/appNavigation';

describe('Pre-installation audit: navigation consolidation', () => {
  it('does not expose a separate administrative entry for institutional receipts', () => {
    const visibleAdministrative = primaryNavigation.filter((item) => item.navigationGroup === 'administration');
    const receiptEntry = visibleAdministrative.find((item) => item.path === '/settings/institutional-receipts');

    expect(receiptEntry, 'El modulo de Recibos no debe seguir apareciendo como entrada administrativa independiente.').toBeUndefined();
  });

  it('keeps the institutional-receipts route available only as legacy redirect alias', () => {
    const receiptRoute = appRoutes.receiptSettings;
    expect(receiptRoute, 'La ruta /settings/institutional-receipts debe seguir declarada como alias legacy.').toBeDefined();
    expect(receiptRoute?.navigation).toBe(false);
  });

  it('keeps a single canonical configuration entry under /settings/fiscal', () => {
    const visibleAdministrative = primaryNavigation.filter((item) => item.navigationGroup === 'administration');
    const configEntries = visibleAdministrative.filter((item) => item.path.startsWith('/settings/'));

    expect(configEntries.map((entry) => entry.path)).toEqual(['/settings/fiscal']);
  });
});

describe('Pre-installation audit: institutional receipt series form', () => {
  it('does not require a receipt_number_color in the normal series schema', async () => {
    const source = await import('node:fs').then((fs) => fs.promises.readFile(
      new URL('../features/receipt-settings/InstitutionalReceiptSettingsView.tsx', import.meta.url),
      'utf-8',
    ));

    const seriesSchemaMatch = source.match(/const\s+seriesSchema\s*=\s*z\.object\(\s*\{([\s\S]*?)\}\)/);
    expect(seriesSchemaMatch, 'seriesSchema debe seguir declarada en el modulo de recibos.').not.toBeNull();
    const seriesSchemaBody = seriesSchemaMatch?.[1] ?? '';

    expect(seriesSchemaBody).not.toContain('receipt_number_color');
  });

  it('does not render a color picker in the normal institutional series form', async () => {
    const source = await import('node:fs').then((fs) => fs.promises.readFile(
      new URL('../features/receipt-settings/InstitutionalReceiptSettingsView.tsx', import.meta.url),
      'utf-8',
    ));

    const typeColorMatch = source.match(/<Input\s+id="receipt_number_color"\s+type="color"/);
    expect(typeColorMatch, 'El selector de color no debe renderizarse en el formulario normal de serie.').toBeNull();
  });

  it('does not render an Institucion tab in the consolidated settings view', async () => {
    const source = await import('node:fs').then((fs) => fs.promises.readFile(
      new URL('../features/receipt-settings/InstitutionalReceiptSettingsView.tsx', import.meta.url),
      'utf-8',
    ));

    expect(source).not.toContain("key: 'institucion'");
    expect(source).not.toContain("label: 'Institución'");
    expect(source).not.toContain("label: 'Institucion'");
  });
});

describe('Pre-installation audit: fiscal sequence form', () => {
  it('does not expose current_number as a writable input in the fiscal sequence form', async () => {
    const source = await import('node:fs').then((fs) => fs.promises.readFile(
      new URL('../features/settings/FiscalNumerationView.tsx', import.meta.url),
      'utf-8',
    ));

    expect(source).not.toMatch(/form\.register\(['"]current_number['"]/);
    expect(source).toContain('El backend lo incrementa al emitir. No se reinicia desde esta pantalla.');
  });
});
