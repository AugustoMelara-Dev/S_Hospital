import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuditoriaTab } from './AuditoriaTab';
import type { OperationsReport } from '../../../lib/api/types';

describe('AuditoriaTab', () => {
  it('renders malformed audit money amounts as safe financial values', () => {
    const operations = {
      date_from: '2026-06-01',
      date_to: '2026-06-01',
      filters: { date_from: '2026-06-01', date_to: '2026-06-01' },
      summary: {
        void_count: 1,
        reprint_count: 0,
        payment_void_count: 1,
        backup_count: 0,
        failed_backup_count: 0,
        cashier_count: 1,
      },
      voids: [
        {
          invoice_number: '000-001-01-00000001',
          patient_name: 'Paciente Anulado',
          total: 'monto-danado',
          reason: 'Correccion',
          voided_at: '2026-06-01T10:00:00.000000Z',
          user: 'Admin Hospital',
        },
      ],
      reprints: [],
      payment_voids: [
        {
          invoice_number: '000-001-01-00000002',
          patient_name: 'Paciente Reverso',
          method: 'card',
          amount: 'NaN',
          reason: 'Pago duplicado',
          voided_at: '2026-06-01T11:00:00.000000Z',
          voided_by: 'Supervisor Hospital',
          cashier: 'Caja Principal',
        },
      ],
      backups: [],
      cashiers: [
        {
          name: 'Caja Principal',
          username: 'caja.principal',
          payment_count: 2,
          cash_session_count: 1,
          invoice_count: 2,
          total_collected: 'no-numero',
        },
      ],
    } satisfies OperationsReport;

    render(
      <AuditoriaTab
        canExport={false}
        operations={operations}
        dateFrom="2026-06-01"
        dateTo="2026-06-01"
        onDateFromChange={() => undefined}
        onDateToChange={() => undefined}
        onExport={() => undefined}
        onExportPdf={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(screen.getByText('Paciente Anulado')).toBeInTheDocument();
    expect(screen.getByText('Paciente Reverso')).toBeInTheDocument();
    expect(screen.getByText('caja.principal')).toBeInTheDocument();
    expect(document.body.textContent).toContain('L. 0.00');
    expect(document.body.textContent).not.toMatch(/\bNaN\b|monto-danado|no-numero|undefined/);
  });

  it('renders catalog audit changes with human labels and without technical fields', () => {
    const operations = {
      date_from: '2026-06-01',
      date_to: '2026-06-01',
      filters: { date_from: '2026-06-01', date_to: '2026-06-01' },
      summary: {
        void_count: 0,
        reprint_count: 0,
        service_change_count: 1,
        payment_void_count: 0,
        backup_count: 0,
        failed_backup_count: 0,
        cashier_count: 0,
      },
      voids: [],
      reprints: [],
      payment_voids: [],
      catalog_changes: [
        {
          action: 'service.price_updated',
          service: 'Glucosa',
          old_values: {
            price: '15.00',
            category_id: 7,
            special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
          },
          new_values: {
            price: '18.00',
            category: 'Laboratorio',
            price_change_reason: 'Ajuste aprobado por administracion',
            special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
          },
          created_at: '2026-06-01T12:00:00.000000Z',
          user: 'Admin Hospital',
        },
      ],
      backups: [],
      cashiers: [],
    } satisfies OperationsReport;

    render(
      <AuditoriaTab
        canExport={false}
        operations={operations}
        dateFrom="2026-06-01"
        dateTo="2026-06-01"
        onDateFromChange={() => undefined}
        onDateToChange={() => undefined}
        onExport={() => undefined}
        onExportPdf={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(screen.getByRole('heading', { name: /cambios de catalogo/i })).toBeInTheDocument();
    expect(screen.getByText('Glucosa')).toBeInTheDocument();
    expect(screen.getByText('Precio actualizado')).toBeInTheDocument();
    expect(screen.getByText('Ajuste aprobado por administracion')).toBeInTheDocument();
    expect(screen.getAllByText(/L\. 15\.00|L\. 18\.00/).length).toBe(2);
    expect(document.body.textContent).toContain('Eritropoyetina con receta de dialisis');
    expect(document.body.textContent).not.toMatch(/service\.price_updated|category_id|ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION/);
  });

  it('renders reprint receipt formats as institutional labels', () => {
    const operations = {
      date_from: '2026-06-01',
      date_to: '2026-06-01',
      filters: { date_from: '2026-06-01', date_to: '2026-06-01' },
      summary: {
        void_count: 0,
        reprint_count: 4,
        payment_void_count: 0,
        backup_count: 0,
        failed_backup_count: 0,
        cashier_count: 0,
      },
      voids: [],
      reprints: [
        {
          invoice_number: '000-001-01-00000001',
          width: 'half_letter',
          reason: 'Copia para paciente',
          created_at: '2026-06-01T10:00:00.000000Z',
          user: 'Cajero Hospital',
        },
        {
          invoice_number: '000-001-01-00000002',
          width: 'letter',
          reason: 'Copia para archivo',
          created_at: '2026-06-01T10:10:00.000000Z',
          user: 'Cajero Hospital',
        },
        {
          invoice_number: '000-001-01-00000003',
          width: 'a5',
          reason: 'Copia solicitada',
          created_at: '2026-06-01T10:20:00.000000Z',
          user: 'Cajero Hospital',
        },
        {
          invoice_number: '000-001-01-00000004',
          width: '80mm',
          reason: 'Registro historico normalizado',
          created_at: '2026-06-01T10:30:00.000000Z',
          user: 'Cajero Hospital',
        },
      ],
      payment_voids: [],
      backups: [],
      cashiers: [],
    } satisfies OperationsReport;

    render(
      <AuditoriaTab
        canExport={false}
        operations={operations}
        dateFrom="2026-06-01"
        dateTo="2026-06-01"
        onDateFromChange={() => undefined}
        onDateToChange={() => undefined}
        onExport={() => undefined}
        onExportPdf={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(screen.getByText('Formato')).toBeInTheDocument();
    expect(screen.getAllByText('Media carta')).toHaveLength(2);
    expect(screen.getByText('Carta')).toBeInTheDocument();
    expect(screen.getByText('A5')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/half_letter|80mm|58mm/);
  });

  it('renders backup audit rows without technical filenames', () => {
    const operations = {
      date_from: '2026-06-01',
      date_to: '2026-06-01',
      filters: { date_from: '2026-06-01', date_to: '2026-06-01' },
      summary: {
        void_count: 0,
        reprint_count: 0,
        payment_void_count: 0,
        backup_count: 2,
        failed_backup_count: 1,
        cashier_count: 0,
      },
      voids: [],
      reprints: [],
      payment_voids: [],
      backups: [
        {
          filename: 'hospital-backup-2026-06-01.sql',
          status: 'success',
          type: 'manual',
          size_bytes: 2048,
          created_at: '2026-06-01T08:15:00.000Z',
          completed_at: '2026-06-01T08:16:00.000Z',
          creator: 'Admin Hospital',
        },
        {
          filename: 'hospital-backup-2026-06-02-failed.sql',
          status: 'failed',
          type: 'scheduled',
          size_bytes: null,
          created_at: null,
          completed_at: null,
          creator: null,
        },
      ],
      cashiers: [],
    } satisfies OperationsReport;

    render(
      <AuditoriaTab
        canExport={false}
        operations={operations}
        dateFrom="2026-06-01"
        dateTo="2026-06-01"
        onDateFromChange={() => undefined}
        onDateToChange={() => undefined}
        onExport={() => undefined}
        onExportPdf={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(screen.getByText('Respaldo manual', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Respaldo automatico', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('fecha no disponible', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Protegido')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/hospital-backup|\.sql|filename/i);
  });
});
