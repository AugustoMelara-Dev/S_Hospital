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

    fireEvent.click(screen.getByRole('button', { name: /guardar numeraci[oó]n/i }));

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
      });
    });
  });

  it('disables the save button without edit permission', async () => {
    render(<FiscalNumerationView canEdit={false} onStatus={vi.fn()} />);

    expect(
      await screen.findByRole('button', { name: /guardar numeraci[oó]n/i }),
    ).toBeDisabled();
  });
});