import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const readSource = (relative: string) => readFileSync(resolve(here, relative), 'utf-8');

describe('Pre-installation audit: institutional receipt series form', () => {
  it('does not require a receipt_number_color in the normal series schema', () => {
    const source = readSource('../features/receipt-settings/InstitutionalReceiptSettingsView.tsx');

    const seriesSchemaMatch = source.match(/const\s+seriesSchema\s*=\s*z\.object\(\s*\{([\s\S]*?)\}\)/);
    expect(seriesSchemaMatch, 'seriesSchema debe seguir declarada en el modulo de recibos.').not.toBeNull();
    const seriesSchemaBody = seriesSchemaMatch?.[1] ?? '';

    expect(seriesSchemaBody).not.toContain('receipt_number_color');
  });

  it('does not render a color picker in the normal institutional series form', () => {
    const source = readSource('../features/receipt-settings/InstitutionalReceiptSettingsView.tsx');

    const typeColorMatch = source.match(/<Input\s+id="receipt_number_color"\s+type="color"/);
    expect(typeColorMatch, 'El selector de color no debe renderizarse en el formulario normal de serie.').toBeNull();
  });

  it('does not render an Institucion tab in the consolidated settings view', () => {
    const source = readSource('../features/receipt-settings/InstitutionalReceiptSettingsView.tsx');

    expect(source).not.toContain("key: 'institucion'");
    expect(source).not.toContain("label: 'Institución'");
    expect(source).not.toContain("label: 'Institucion'");
  });
});

describe('Pre-installation audit: fiscal sequence form', () => {
  it('does not expose current_number as a writable input in the fiscal sequence form', () => {
    const source = readSource('../features/settings/FiscalNumerationView.tsx');

    expect(source).not.toMatch(/form\.register\(['"]current_number['"]/);
    expect(source).toContain('El número aumenta al emitir una factura. No se reinicia desde esta pantalla.');
  });
});

describe('Pre-installation audit: H1 canonical institution source', () => {
  it('HospitalSettingsView is the only React form that writes institution identity fields', () => {
    const hospitalSource = readSource('../features/settings/HospitalSettingsView.tsx');
    const receiptSource = readSource('../features/receipt-settings/InstitutionalReceiptSettingsView.tsx');
    const fiscalSource = readSource('../features/administracion/AjustesView.tsx');

    expect(hospitalSource).toContain('hospital_name');
    expect(hospitalSource).toContain('government_line');
    expect(hospitalSource).toContain('secretariat_line');
    expect(hospitalSource).toContain('receipt_location');

    expect(receiptSource).not.toMatch(/institutionSchema\s*=\s*z\.object/);
    expect(receiptSource).not.toMatch(/updateReceiptInstitution\(/);
    expect(receiptSource).not.toContain("key: 'institucion'");
    expect(receiptSource).not.toMatch(/<form[^>]*onSubmit=\{institutionForm/);

    expect(fiscalSource).toContain('<HospitalSettingsView');
  });

  it('AppRoutes retira la ruta R2 de recibos y la redirige al destino administrativo nuevo', () => {
    const appRoutesSource = readSource('../AppRoutes.tsx');

    expect(appRoutesSource).toContain(
      '<Route path="/settings/*" element={<Navigate to={adminRoutePaths.administracionAjustes} replace />} />',
    );
    expect(appRoutesSource, 'La URL de recibos ya no debe montar la vista R2.').not.toContain(
      "import('./features/receipt-settings/InstitutionalReceiptSettingsView')",
    );
  });
});

describe('Pre-installation audit: H2 separate numbering', () => {
  it('does not import FiscalSequence in InstitutionalReceiptSeries or vice versa', () => {
    const institutionalSeriesModel = readSource('../../../backend/app/Models/InstitutionalReceiptSeries.php');
    const fiscalSequenceModel = readSource('../../../backend/app/Models/FiscalSequence.php');

    expect(institutionalSeriesModel).not.toContain('FiscalSequence');
    expect(fiscalSequenceModel).not.toContain('InstitutionalReceiptSeries');

    const institutionalController = readSource('../../../backend/app/Http/Controllers/InstitutionalReceiptSettingsController.php');
    expect(institutionalController).not.toContain('FiscalSequence::');
    expect(institutionalController).not.toMatch(/->update\(\s*\[\s*['"]current_number['"]/);
    expect(institutionalController).not.toMatch(/fill\(\s*\[\s*['"]current_number['"]/);
  });
});

describe('Pre-installation audit: H3 color out of normal flow', () => {
  it('UpdateReceiptSeriesRequest treats receipt_number_color as optional', () => {
    const requestSource = readSource('../../../backend/app/Http/Requests/InstitutionalReceipts/UpdateReceiptSeriesRequest.php');

    expect(requestSource).toContain('receipt_number_color');
    expect(requestSource).toMatch(/receipt_number_color['"]\s*=>\s*\[\s*'sometimes'/);
  });

  it('InstitutionalReceiptSeriesView omits the color picker and the field from the normal form', () => {
    const source = readSource('../features/receipt-settings/InstitutionalReceiptSettingsView.tsx');
    expect(source).not.toMatch(/<Input\s+id="receipt_number_color"\s+type="color"/);
    expect(source).not.toMatch(/name="receipt_number_color"/);
    expect(source).not.toMatch(/label:\s*['"]Color del número['"]/);
  });
});

describe('Pre-installation audit: H4 Honduras defaults', () => {
  it('HondurasDistributionSeeder declares the canonical constants', () => {
    const seederSource = readSource('../../../backend/database/seeders/HondurasDistributionSeeder.php');

    expect(seederSource).toContain('HOSPITAL_NAME');
    expect(seederSource).toContain('GOVERNMENT_LINE');
    expect(seederSource).toContain('SECRETARIAT_LINE');
    expect(seederSource).toContain('RECEIPT_LOCATION');
    expect(seederSource).not.toContain('VALIDACION-CAI');
    expect(seederSource).not.toContain('08019999123456');
    expect(seederSource).not.toContain('2444-0000');
    expect(seederSource).not.toMatch(/cai\s*=\s*['"][A-Z0-9-]/i);
    expect(seederSource).not.toMatch(/range_authorization\s*=\s*['"][A-Z0-9-]/i);
  });

  it('HondurasDistributionSeeder does not introduce FiscalSequence rows', () => {
    const seederSource = readSource('../../../backend/database/seeders/HondurasDistributionSeeder.php');
    expect(seederSource).not.toContain('FiscalSequence');
    expect(seederSource).not.toMatch(/min_number\s*=/);
    expect(seederSource).not.toMatch(/max_number\s*=/);
    expect(seederSource).not.toMatch(/valid_until\s*=/);
  });
});

describe('Pre-installation audit: H5/H6 maintenance launcher and icons', () => {
  it('install_hospital_startup_shortcut.ps1 defaults to the maintenance console', () => {
    const source = readSource('../../../scripts/install_hospital_startup_shortcut.ps1');
    expect(source).toContain('maintenance_hospital_windows.ps1');
    expect(source).not.toMatch(/restore_hospital_windows\.ps1['"]?\s*\}/);
  });

  it('maintenance console avoids depending on host MySQL', () => {
    const source = readSource('../../../scripts/maintenance_hospital_windows.ps1');
    expect(source).toContain('docker compose');
    expect(source).not.toMatch(/mysql\.exe[^a-z]/);
  });

  it('three multiresolution icons exist and are distinct', () => {
    const readSize = (relative: string) => readFileSync(resolve(here, `../../public/icons/${relative}`)).length;
    const appSize = readSize('s-hospital-app.ico');
    const installerSize = readSize('s-hospital-installer.ico');
    const maintenanceSize = readSize('s-hospital-maintenance.ico');

    expect(appSize, 's-hospital-app.ico debe existir').toBeGreaterThan(4096);
    expect(installerSize, 's-hospital-installer.ico debe existir').toBeGreaterThan(4096);
    expect(maintenanceSize, 's-hospital-maintenance.ico debe existir').toBeGreaterThan(4096);

    expect(appSize).not.toBe(installerSize);
    expect(installerSize).not.toBe(maintenanceSize);
    expect(appSize).not.toBe(maintenanceSize);
  });
});
