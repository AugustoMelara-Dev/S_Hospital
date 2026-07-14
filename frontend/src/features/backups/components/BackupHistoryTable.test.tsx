import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BackupLog } from '@/lib/api';
import { BackupHistoryTable } from './BackupHistoryTable';

const successfulBackup: BackupLog = {
  id: 11,
  size_bytes: 2048,
  status: 'success',
  type: 'manual',
  created_by: 2,
  completed_at: '2026-07-10T08:15:00.000Z',
  created_at: '2026-07-10T08:14:00.000Z',
  updated_at: '2026-07-10T08:15:00.000Z',
  creator: { id: 2, name: 'Caja Principal', username: 'caja' },
};

describe('BackupHistoryTable responsive history', () => {
  it.each([320, 375])('renders mobile backup cards with the real download action at %ipx', (width) => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      matches: query.includes('max-width') && width <= 767,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const onDownloadRequest = vi.fn();

    render(
      <BackupHistoryTable
        backups={[successfulBackup]}
        canDownload
        downloadingBackupId={null}
        onDownloadRequest={onDownloadRequest}
        onStatusFilterChange={vi.fn()}
        statusFilter="all"
      />,
    );

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: /historial de respaldos locales/i })).toBeInTheDocument();
    expect(screen.getByText(/caja principal/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /descargar respaldo del/i }));
    expect(onDownloadRequest).toHaveBeenCalledWith(successfulBackup);
  });

  it('does not expose download in mobile cards without permission', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      matches: query.includes('max-width'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(
      <BackupHistoryTable
        backups={[successfulBackup]}
        canDownload={false}
        downloadingBackupId={null}
        onDownloadRequest={vi.fn()}
        onStatusFilterChange={vi.fn()}
        statusFilter="all"
      />,
    );

    expect(screen.queryByRole('button', { name: /descargar respaldo/i })).not.toBeInTheDocument();
    expect(screen.getByText(/sin descarga/i)).toBeInTheDocument();
  });
});
