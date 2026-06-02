import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AboutView } from './AboutView';
import { useFiscalSettings } from '../../hooks/useFiscalSettings';
import { useServerStatus } from '../../hooks/useServerStatus';
import { apiClient } from '../../lib/api';

vi.mock('../../hooks/useFiscalSettings', () => ({
  useFiscalSettings: vi.fn(),
}));

vi.mock('../../hooks/useServerStatus', () => ({
  useServerStatus: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  apiClient: {
    getBackups: vi.fn(),
  },
}));

describe('AboutView', () => {
  beforeEach(() => {
    vi.mocked(useFiscalSettings).mockReturnValue({
      data: { hospital_name: 'Hospital San Isidro' },
    } as ReturnType<typeof useFiscalSettings>);
    vi.mocked(apiClient.getBackups).mockResolvedValue({ data: [], meta: { current_page: 1, per_page: 15, total: 0 } });
  });

  it('shows the operational health summary in non-technical language', async () => {
    vi.mocked(useServerStatus).mockReturnValue({
      checking: false,
      isOnline: true,
      lastCheck: new Date('2026-06-02T14:00:00.000Z'),
      operationalHealth: null,
      summary: {
        description: 'Servidor local, base de datos y respaldos responden. Mantenga el cierre diario y los respaldos protegidos.',
        label: 'Todo bien',
        level: 'ok',
      },
    });

    render(<AboutView onStatus={vi.fn()} />);

    expect(screen.getAllByText('Todo bien')).toHaveLength(2);
    expect(screen.getByText(/base de datos y respaldos responden/i)).toBeInTheDocument();
    await waitFor(() => expect(apiClient.getBackups).toHaveBeenCalled());
  });

  it('shows a review summary without exposing raw technical details', async () => {
    vi.mocked(useServerStatus).mockReturnValue({
      checking: false,
      isOnline: true,
      lastCheck: new Date('2026-06-02T14:00:00.000Z'),
      operationalHealth: null,
      summary: {
        description: 'Hay trabajos o respaldos con alerta. Revise Respaldos y pida soporte si el problema se repite.',
        label: 'Requiere revision',
        level: 'review',
      },
    });

    render(<AboutView onStatus={vi.fn()} />);

    expect(screen.getAllByText('Requiere revision')).toHaveLength(2);
    expect(screen.getByText(/pida soporte/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/queue:work|App\\\\|DB_PASSWORD|\.env|C:\\\\/i);
    await waitFor(() => expect(apiClient.getBackups).toHaveBeenCalled());
  });
});
