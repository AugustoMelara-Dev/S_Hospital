import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from './base';
import { reports } from './reports';

vi.mock('./base', () => ({
  apiClient: {
    download: vi.fn(),
    request: vi.fn(),
    url: vi.fn((path: string) => path),
  },
}));

const mockedDownload = vi.mocked(apiClient.download);
const mockedRequest = vi.mocked(apiClient.request);

function pdfSearchParams(): URLSearchParams {
  const [path] = mockedDownload.mock.calls[0] ?? [];
  expect(path).toBeTypeOf('string');

  return new URL(`http://hospital.test${path}`).searchParams;
}

describe('reports api client', () => {
  beforeEach(() => {
    mockedDownload.mockReset();
    mockedRequest.mockReset();
  });

  it('downloads daily pdf reports with the explicit daily date parameter', async () => {
    const pdf = new Blob(['pdf']);
    mockedDownload.mockResolvedValueOnce(pdf);

    await expect(reports.downloadPdf({
      date: '2026-06-02',
      date_from: '2026-06-02',
      date_to: '2026-06-02',
    })).resolves.toBe(pdf);

    expect(mockedDownload).toHaveBeenCalledTimes(1);
    const params = pdfSearchParams();
    expect(params.get('date')).toBe('2026-06-02');
    expect(params.get('date_from')).toBe('2026-06-02');
    expect(params.get('date_to')).toBe('2026-06-02');
  });

  it('omits empty optional filters from pdf report requests', async () => {
    mockedDownload.mockResolvedValueOnce(new Blob(['pdf']));

    await reports.downloadPdf({
      date_from: '2026-06-01',
      date_to: '2026-06-02',
      method: '',
      status: null,
      user_id: undefined,
    });

    const params = pdfSearchParams();
    expect(params.get('date_from')).toBe('2026-06-01');
    expect(params.get('date_to')).toBe('2026-06-02');
    expect(params.has('method')).toBe(false);
    expect(params.has('status')).toBe(false);
    expect(params.has('user_id')).toBe(false);
  });
  it('downloads cash session excel reports through the explicit cash-session helper', async () => {
    const xlsx = new Blob(['xlsx']);
    mockedDownload.mockResolvedValueOnce(xlsx);

    await expect(reports.downloadCashSessionReportExcel({
      date_from: '2026-06-02',
      date_to: '2026-06-02',
      cash_session_id: 12,
    })).resolves.toBe(xlsx);

    expect(mockedDownload).toHaveBeenCalledTimes(1);
    const [path] = mockedDownload.mock.calls[0];
    expect(path).toContain('/api/reports/export?');
    const params = pdfSearchParams();
    expect(params.get('date_from')).toBe('2026-06-02');
    expect(params.get('date_to')).toBe('2026-06-02');
    expect(params.get('cash_session_id')).toBe('12');
  });

  it('downloads cash session pdf reports through the explicit cash-session helper', async () => {
    const pdf = new Blob(['pdf']);
    mockedDownload.mockResolvedValueOnce(pdf);

    await expect(reports.downloadCashSessionReportPdf({
      date_from: '2026-06-02',
      date_to: '2026-06-02',
      cash_session_id: 12,
    })).resolves.toBe(pdf);

    expect(mockedDownload).toHaveBeenCalledTimes(1);
    const [path] = mockedDownload.mock.calls[0];
    expect(path).toContain('/api/reports/pdf?');
    const params = pdfSearchParams();
    expect(params.get('date_from')).toBe('2026-06-02');
    expect(params.get('date_to')).toBe('2026-06-02');
    expect(params.get('cash_session_id')).toBe('12');
  });

  it('fetches the operations report through the explicit operations endpoint', async () => {
    const report = {
      date_from: '2026-07-01',
      date_to: '2026-07-31',
      filters: {},
      summary: {
        void_count: 0,
        reprint_count: 0,
        audit_event_count: 0,
        service_change_count: 0,
        payment_void_count: 0,
        backup_count: 0,
        failed_backup_count: 0,
        cashier_count: 0,
      },
      voids: [],
      reprints: [],
      catalog_changes: [],
      payment_voids: [],
      backups: [],
      cashiers: [],
    };
    mockedRequest.mockResolvedValueOnce({ data: report });

    await expect(reports.getOperationsReport({
      date_from: '2026-07-01',
      date_to: '2026-07-31',
    })).resolves.toBe(report);

    expect(mockedRequest).toHaveBeenCalledWith('/api/reports/operations?date_from=2026-07-01&date_to=2026-07-31');
  });
});
