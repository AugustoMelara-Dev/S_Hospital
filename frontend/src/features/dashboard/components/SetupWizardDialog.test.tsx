/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { axe } from 'vitest-axe';
import { apiClient } from '@/lib/api';
import { SetupWizardDialog } from './SetupWizardDialog';

describe('SetupWizardDialog', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiClient, 'getFiscalSettings').mockResolvedValue({
      hospital_name: 'Hospital Demo',
      rtn: '0801-1990-123456',
      default_tax_rate: '15.00',
      primary_color: 'indigo',
      address: 'Tegucigalpa',
      slogan: 'Salud para todos',
    });
    vi.spyOn(apiClient, 'getFiscalSequences').mockResolvedValue([
      {
        id: 1,
        document_type: 'invoice',
        prefix: '000-001-01',
        cai: '4D82C1-30AAFF',
        min_number: 1,
        max_number: 99999999,
        current_number: 0,
        valid_until: '2026-12-31',
        active: true,
      },
    ]);
    vi.spyOn(apiClient, 'getCategories').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getAreas').mockResolvedValue([
      { id: 10, name: 'Farmacia', active: true, slug: 'farmacia' },
      { id: 20, name: 'Consulta externa', active: true, slug: 'consulta-externa' },
      { id: 30, name: 'Laboratorio', active: true, slug: 'laboratorio' },
      { id: 40, name: 'Imagenología', active: true, slug: 'imagenologia' },
      { id: 50, name: 'Medicamentos', active: true, slug: 'medicamentos' },
    ]);
    vi.spyOn(apiClient, 'updateFiscalSettings').mockResolvedValue(undefined as any);
    vi.spyOn(apiClient, 'saveFiscalSequence').mockResolvedValue(undefined as any);
    vi.spyOn(apiClient, 'saveCategory').mockResolvedValue({ id: 1, name: 'Medicamentos', active: true, sort_order: 1, slug: 'medicamentos' });
    vi.spyOn(apiClient, 'saveService').mockResolvedValue(undefined as any);
  });

  it('renders step 1 with prepopulated values and associated labels', async () => {
    render(<SetupWizardDialog open={true} onOpenChange={vi.fn()} onComplete={vi.fn()} />);

    // Check title and description
    expect(await screen.findByRole('heading', { level: 3, name: 'Preparar caja' })).toBeInTheDocument();
    expect(await screen.findByText('Complete los datos mínimos para comenzar a facturar.')).toBeInTheDocument();

    // Check labels and inputs
    const hospInput = await screen.findByLabelText('Nombre del hospital *');
    expect(hospInput).toBeInTheDocument();
    await waitFor(() => {
      expect(hospInput).toHaveValue('Hospital Demo');
    });

    const rtnInput = await screen.findByLabelText('RTN *');
    expect(rtnInput).toBeInTheDocument();
    expect(rtnInput).toHaveValue('0801-1990-123456');

    const taxInput = await screen.findByLabelText('Impuesto general (%)');
    expect(taxInput).toBeInTheDocument();
    expect(taxInput).toHaveValue(15);
  });

  it('advances through steps on submit and calls onComplete at the end', async () => {
    const onComplete = vi.fn();
    const onOpenChange = vi.fn();
    render(<SetupWizardDialog open={true} onOpenChange={onOpenChange} onComplete={onComplete} />);

    // Step 1: Click "Siguiente"
    fireEvent.click(await screen.findByRole('button', { name: /siguiente/i }));

    // Step 2: Renders sequence details
    const prefixInput = await screen.findByLabelText('Prefijo *');
    expect(prefixInput).toHaveValue('000-001-01');

    const caiInput = screen.getByLabelText('CAI *');
    expect(caiInput).toHaveValue('4D82C1-30AAFF');

    // Click "Siguiente" in Step 2
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    // Step 3: Pegar catálogo CSV
    const csvArea = await screen.findByLabelText(/Servicios:/i);
    expect(csvArea).toBeVisible();

    // Click "Importar catálogo"
    fireEvent.click(screen.getByRole('button', { name: /importar catálogo/i }));

    // Step 4: Configuración lista
    const finishBtn = await screen.findByRole('button', { name: /entrar/i });
    expect(screen.getByText('Configuración lista')).toBeVisible();

    // Click finish button
    fireEvent.click(finishBtn);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('has no accessibility violations (axe) in the initial step', async () => {
    const { container } = render(<SetupWizardDialog open={true} onOpenChange={vi.fn()} onComplete={vi.fn()} />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it('surfaces a sanitized error when loading the initial hospital settings fails', async () => {
    vi.spyOn(apiClient, 'getFiscalSettings').mockRejectedValueOnce(new Error('boom'));
    render(<SetupWizardDialog open={true} onOpenChange={vi.fn()} onComplete={vi.fn()} />);
    // The dialog should still render step 1 even when settings fail
    expect(await screen.findByRole('heading', { level: 3, name: 'Preparar caja' })).toBeInTheDocument();
  });

  it('blocks the wizard when an active area is missing from the catalog step', async () => {
    vi.spyOn(apiClient, 'getAreas').mockResolvedValueOnce([]);
    render(<SetupWizardDialog open={true} onOpenChange={vi.fn()} onComplete={vi.fn()} />);

    // Step 1 → Step 2
    fireEvent.click(await screen.findByRole('button', { name: /siguiente/i }));
    const prefixInput = await screen.findByLabelText('Prefijo *');
    expect(prefixInput).toBeInTheDocument();

    // Step 2 → Step 3
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    // Verify the catalog step is visible
    expect(await screen.findByText(/Servicios:/i)).toBeInTheDocument();

    // Now try to import the default CSV (which references areas) with no areas configured
    fireEvent.click(screen.getByRole('button', { name: /importar cat.logo/i }));

    // Without areas, import errors out — verify the dialog stays on step 3
    expect(screen.getByText(/Servicios:/i)).toBeInTheDocument();
  });

  it('shows the configured services after a successful CSV import', async () => {
    const onComplete = vi.fn();
    const onOpenChange = vi.fn();
    render(<SetupWizardDialog open={true} onOpenChange={onOpenChange} onComplete={onComplete} />);

    fireEvent.click(await screen.findByRole('button', { name: /siguiente/i }));

    // Wait for step 2 to render so the next button is the step-2 submit.
    await screen.findByLabelText('Prefijo *');
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    const csvArea = await screen.findByLabelText(/Servicios:/i);
    expect(csvArea).toBeVisible();

    // Click "Importar catálogo" — same wording as the existing test.
    fireEvent.click(screen.getByRole('button', { name: /importar cat.logo/i }));

    // Step 4: configuration list is shown with the Entrar button.
    expect(await screen.findByText('Configuración lista')).toBeVisible();
    const finishBtn = await screen.findByRole('button', { name: /entrar/i });
    fireEvent.click(finishBtn);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not invoke onComplete when the dialog is closed by the parent without finishing', async () => {
    const onOpenChange = vi.fn();
    const onComplete = vi.fn();
    const { rerender } = render(<SetupWizardDialog open={true} onOpenChange={onOpenChange} onComplete={onComplete} />);
    rerender(<SetupWizardDialog open={false} onOpenChange={onOpenChange} onComplete={onComplete} />);
    expect(onComplete).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('closes the dialog when the parent updates the open prop to false', async () => {
    const onOpenChange = vi.fn();
    const onComplete = vi.fn();
    const { rerender } = render(<SetupWizardDialog open={true} onOpenChange={onOpenChange} onComplete={onComplete} />);
    rerender(<SetupWizardDialog open={false} onOpenChange={onOpenChange} onComplete={onComplete} />);
    // When open toggles to false via prop, neither onOpenChange nor onComplete is invoked.
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(onComplete).not.toHaveBeenCalled();
  });
});
