import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SetupWizardDialog } from './SetupWizardDialog';
import { apiClient } from '@/lib/api';

describe('SetupWizardDialog', () => {
  it('does not prefill demo hospital, fiscal or catalog data', async () => {
    vi.spyOn(apiClient, 'getFiscalSettings').mockResolvedValue(null);
    vi.spyOn(apiClient, 'getFiscalSequences').mockResolvedValue([]);
    vi.spyOn(apiClient, 'updateFiscalSettings').mockResolvedValue({
      id: 1,
      hospital_name: 'Hospital San Isidro',
      rtn: '',
      address: '',
      slogan: '',
      default_tax_rate: '15.00',
      receipt_template_mode: 'institutional',
      receipt_paper_size: 'half_letter',
      receipt_location: null,
      receipt_footer_text: null,
      primary_color: 'indigo',
      scanner_enabled: false,
      partial_payments_enabled: false,
    });
    vi.spyOn(apiClient, 'saveFiscalSequence').mockResolvedValue({
      id: 1,
      document_type: 'invoice',
      prefix: '000-001-01',
      cai: 'CAI-AUTORIZADO',
      min_number: 1,
      max_number: 99999999,
      current_number: 0,
      valid_until: '2027-12-31',
      active: true,
    });

    render(<SetupWizardDialog open onOpenChange={vi.fn()} onComplete={vi.fn()} />);

    await waitFor(() => expect(apiClient.getFiscalSettings).toHaveBeenCalled());

    expect(screen.getByPlaceholderText('Hospital San Isidro')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Buen Pastor/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Nombre del hospital/i), {
      target: { value: 'Hospital San Isidro' },
    });
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    expect(await screen.findByLabelText(/CAI/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('CAI autorizado')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/4D82C1/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/CAI/i), {
      target: { value: 'CAI-AUTORIZADO' },
    });
    fireEvent.change(screen.getByLabelText(/Fecha limite/i), {
      target: { value: '2027-12-31' },
    });
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    const catalogInput = await screen.findByLabelText(/Servicios: categoria, area, servicio, precio, impuesto/i);
    expect(catalogInput).toHaveValue('Categoria, Area, Servicio, Precio, Gravado (S/N)');
    expect(catalogInput).toHaveAttribute('placeholder', 'Pegue aqui el catalogo real aprobado por administracion.');
    expect(catalogInput).not.toHaveValue(expect.stringMatching(/Consulta General|Consulta Especialista|Hemograma|Radiografia|Eritropoyetina 4000 UI/i));
    expect(document.body.textContent).not.toMatch(/Buen Pastor|4D82C1|Consulta General|Consulta Especialista|Hemograma|Radiografia Torax/i);
  });
});
