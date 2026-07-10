import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FiscalNumerationView } from './FiscalNumerationView';
import { apiClient, type FiscalSequence } from '@/lib/api';

const baseSequence: FiscalSequence = {
  id: 1,
  document_type: 'invoice',
  prefix: 'A',
  min_number: 1,
  max_number: 1000,
  current_number: 10,
  cai: 'CAI-TEST',
  valid_until: '2026-12-31',
  active: true,
};

describe('FiscalNumerationView', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getFiscalSequences').mockResolvedValue([baseSequence]);
    vi.spyOn(apiClient, 'saveFiscalSequence').mockResolvedValue(baseSequence);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('seeds the fiscal sequence form from the first sequence returned by the API', async () => {
    render(<FiscalNumerationView canEdit onStatus={vi.fn()} />);

    expect(await screen.findByLabelText(/^prefijo$/i)).toHaveValue('A');
    expect(screen.getByLabelText(/^cai$/i)).toHaveValue('CAI-TEST');
    expect(screen.getByLabelText(/desde el n[uú]mero/i)).toHaveValue(1);
    expect(screen.getByLabelText(/hasta el n[uú]mero/i)).toHaveValue(1000);
    expect(screen.getByLabelText(/v[aá]lido hasta/i)).toHaveValue('2026-12-31');
  });

  it('submits the fiscal sequence with the preserved current_number and id', async () => {
    const saveFiscalSequence = vi.mocked(apiClient.saveFiscalSequence);

    render(<FiscalNumerationView canEdit onStatus={vi.fn()} />);

    const prefixInput = await screen.findByLabelText(/^prefijo$/i);
    fireEvent.change(prefixInput, { target: { value: 'B' } });
    fireEvent.change(screen.getByLabelText(/motivo del cambio fiscal/i), {
      target: { value: 'Nuevo rango autorizado por SAR' },
    });

    fireEvent.click(screen.getByRole('button', { name: /guardar numeraci/i }));
    fireEvent.click(await screen.findByRole('button', { name: /confirmar y guardar/i }));

    await waitFor(() => {
      expect(saveFiscalSequence).toHaveBeenCalledWith({
        id: 1,
        document_type: 'invoice',
        prefix: 'B',
        cai: 'CAI-TEST',
        min_number: 1,
        max_number: 1000,
        current_number: 10,
        valid_until: '2026-12-31',
        active: true,
        reason: 'Nuevo rango autorizado por SAR',
      });
    });
  });

  it('reviews the fiscal impact before preserving the exact sequence payload', async () => {
    const saveFiscalSequence = vi.mocked(apiClient.saveFiscalSequence);

    render(<FiscalNumerationView canEdit onStatus={vi.fn()} />);

    fireEvent.change(await screen.findByLabelText(/^prefijo$/i), { target: { value: 'B' } });
    fireEvent.change(screen.getByLabelText(/hasta el n[uú]mero/i), { target: { value: '1200' } });
    fireEvent.change(screen.getByLabelText(/motivo del cambio fiscal/i), {
      target: { value: 'Nuevo rango autorizado por SAR' },
    });
    fireEvent.click(screen.getByRole('button', { name: /guardar numeraci/i }));

    const dialog = await screen.findByRole('alertdialog', { name: /revisar cambio fiscal/i });
    expect(dialog).toHaveTextContent(/prefijo/i);
    expect(dialog).toHaveTextContent(/A/);
    expect(dialog).toHaveTextContent(/B/);
    expect(dialog).toHaveTextContent(/correlativo actual no cambia/i);
    expect(saveFiscalSequence).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /confirmar y guardar/i }));

    await waitFor(() => {
      expect(saveFiscalSequence).toHaveBeenCalledWith({
        id: 1,
        document_type: 'invoice',
        prefix: 'B',
        cai: 'CAI-TEST',
        min_number: 1,
        max_number: 1200,
        current_number: 10,
        valid_until: '2026-12-31',
        active: true,
        reason: 'Nuevo rango autorizado por SAR',
      });
    });
  });

  it('expresses remaining range and expiry state with text instead of color alone', async () => {
    vi.mocked(apiClient.getFiscalSequences).mockResolvedValue([{ ...baseSequence, max_number: 12 }]);

    render(<FiscalNumerationView canEdit onStatus={vi.fn()} />);

    expect(await screen.findByText(/2 n[uú]meros disponibles/i)).toBeInTheDocument();
    expect(screen.getByText(/vigente hasta/i)).toBeInTheDocument();
  });

  it('requires a fiscal reason before saving changed fiscal sequence data', async () => {
    const saveFiscalSequence = vi.mocked(apiClient.saveFiscalSequence);

    render(<FiscalNumerationView canEdit onStatus={vi.fn()} />);

    const prefixInput = await screen.findByLabelText(/^prefijo$/i);
    fireEvent.change(prefixInput, { target: { value: 'B' } });

    fireEvent.click(screen.getByRole('button', { name: /guardar numeraci/i }));

    expect(await screen.findByText(/indique al menos 5 caracteres/i)).toBeInTheDocument();
    expect(saveFiscalSequence).not.toHaveBeenCalled();
  });

  it('disables the save button without edit permission', async () => {
    render(<FiscalNumerationView canEdit={false} onStatus={vi.fn()} />);

    expect(
      await screen.findByRole('button', { name: /guardar numeraci/i }),
    ).toBeDisabled();
  });
});
