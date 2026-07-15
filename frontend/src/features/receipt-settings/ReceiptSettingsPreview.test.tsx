import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ReceiptSettingsPreview,
  calculateReceiptPreviewScale,
} from './components/ReceiptSettingsPreview';
import type { InstitutionalReceiptSeries, ReceiptPrintProfile } from '@/lib/api';

const series: InstitutionalReceiptSeries = {
  id: 1,
  document_type: 'institutional_receipt',
  series: 'REC-A',
  prefix: 'RA',
  number_format: '{series}-{number:08}',
  min_number: 1,
  max_number: 100,
  current_number: 4,
  range_authorization: 'AUT-1',
  legal_text: 'Texto legal',
  receipt_number_color: ['#', 'b91c1c'].join(''),
  active: true,
  reprint_behavior: 'audit_only',
  void_behavior: 'permission_reason_audit',
};

const profile: ReceiptPrintProfile = {
  id: 1,
  code: 'media_carta_horizontal',
  name: 'Media carta horizontal',
  paper_kind: 'half_letter_landscape',
  width_mm: '215.90',
  height_mm: '139.70',
  margin_top_mm: '6.00',
  margin_right_mm: '6.00',
  margin_bottom_mm: '6.00',
  margin_left_mm: '6.00',
  orientation: 'landscape',
  template_code: 'institutional_classic',
  font_family: 'Arial, sans-serif',
  font_scale: '1.00',
  copies_mode: 'original_only',
  show_copy_legend: true,
  show_physical_seal_space: true,
  use_logo: false,
  show_technical_fields: false,
  active: true,
  is_global_default: true,
};

describe('ReceiptSettingsPreview', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-03T09:30:00-06:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the classic institutional fields without technical labels', () => {
    render(
      <ReceiptSettingsPreview
        hospitalName="Hospital San Isidro"
        governmentLine="Gobierno de Honduras"
        secretariatLine="Secretaria de Salud"
        location="Tocoa, Colon"
        footerText="Original: Oficina Recaudadora"
        series={series}
        profile={profile}
        paper="half_letter"
      />,
    );

    expect(screen.getByText('Hospital San Isidro')).toBeInTheDocument();
    expect(screen.getByText('PRUEBA - SIN VALIDEZ')).toBeInTheDocument();
    expect(screen.getByText(/Próximo estimado/)).toBeInTheDocument();
    expect(screen.getByText('Paciente')).toBeInTheDocument();
    expect(screen.getByText('Monto en letras')).toBeInTheDocument();
    expect(document.body.textContent).toContain('Texto legal VEINTICINCO LEMPIRAS CON 00/100 CENTAVOS');
    expect(screen.getByRole('table', { name: /detalle sintético/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /descripción/i })).toBeInTheDocument();
    expect(screen.getByText('Consulta de medicina general')).toBeInTheDocument();
    expect(document.body.textContent).toContain('Fecha: 03/07/2026');
    expect(screen.getByText('Espacio para sello/firma')).toBeInTheDocument();
    expect(document.body.textContent).toContain('ORIGINAL');
    expect(document.body.textContent).not.toMatch(/CAI|barcode|qr_code|user_id|Estado|PDF final|servidor/);
    expect(screen.getByRole('region', { name: 'Vista previa de recibo Media carta' })).toBeInTheDocument();
    expect(screen.getByText('Vista previa')).toBeInTheDocument();
  });

  it('does not invent optional institutional header lines when they are blank', () => {
    render(
      <ReceiptSettingsPreview
        hospitalName="Hospital San Isidro"
        governmentLine=""
        secretariatLine=""
        location=""
        footerText=""
        series={series}
        profile={profile}
        paper="half_letter"
      />,
    );

    expect(screen.getByText('Hospital San Isidro')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Gobierno de Honduras|Secretaria de Salud|Tocoa/);
    expect(screen.getByText(/Copia digital guardada en sistema/)).toBeInTheDocument();
  });

  it('uses the semantic error tag when no configured series color exists', () => {
    render(
      <ReceiptSettingsPreview
        hospitalName="Hospital San Isidro"
        governmentLine=""
        secretariatLine=""
        location=""
        footerText=""
        series={null}
        profile={profile}
        paper="half_letter"
      />,
    );

    expect(screen.getByText('PRUEBA-SIN-SERIE')).toHaveClass('text-receipt-muted');
  });

  it('renders configured physical copies as separate pages', () => {
    render(
      <ReceiptSettingsPreview
        hospitalName="Hospital San Isidro"
        governmentLine="Gobierno de Honduras"
        secretariatLine="Secretaria de Salud"
        location="Tocoa, Colon"
        footerText="Copia digital guardada"
        series={series}
        profile={{ ...profile, copies_mode: 'original_first_second' }}
        paper="half_letter"
      />,
    );

    expect(screen.getByText(/ORIGINAL/)).toBeInTheDocument();
    expect(screen.getByText(/PRIMERA COPIA/)).toBeInTheDocument();
    expect(screen.getByText(/SEGUNDA COPIA/)).toBeInTheDocument();
  });

  it('hides the seal and signature space when the profile disables it', () => {
    render(
      <ReceiptSettingsPreview
        hospitalName="Hospital San Isidro"
        governmentLine="Gobierno de Honduras"
        secretariatLine="Secretaria de Salud"
        location="Tocoa, Colon"
        footerText="Original: Oficina Recaudadora"
        series={series}
        profile={{ ...profile, show_physical_seal_space: false }}
        paper="half_letter"
      />,
    );

    expect(screen.getByText('Firma del enterante')).toBeInTheDocument();
    expect(screen.queryByText('Espacio para sello/firma')).not.toBeInTheDocument();
  });

  it('uses the A5 paper proportion for A5 receipt previews', () => {
    render(
      <ReceiptSettingsPreview
        hospitalName="Hospital San Isidro"
        governmentLine="Gobierno de Honduras"
        secretariatLine="Secretaria de Salud"
        location="Tocoa, Colon"
        footerText="Original: Oficina Recaudadora"
        series={series}
        paper="a5"
        profile={{
          ...profile,
          code: 'a5_horizontal',
          name: 'A5 horizontal',
          paper_kind: 'a5_landscape',
          width_mm: '210.00',
          height_mm: '148.00',
        }}
      />,
    );

    expect(screen.getByRole('region', { name: 'Vista previa de recibo A5' })).toHaveStyle({
      aspectRatio: '210 / 148',
    });
    expect(screen.getByRole('region', { name: 'Vista previa de recibo A5' })).toHaveClass(
      'receipt-paper-preview--a5',
    );
  });

  it('uses the configured millimetre geometry for a custom receipt profile', () => {
    render(
      <ReceiptSettingsPreview
        hospitalName="Hospital San Isidro"
        governmentLine="Gobierno de Honduras"
        secretariatLine="Secretaria de Salud"
        location="Tocoa, Colon"
        footerText="Original: Oficina Recaudadora"
        series={series}
        paper="custom"
        profile={{
          ...profile,
          code: 'recibo_pequeno_personalizado',
          name: 'Recibo personalizado',
          paper_kind: 'custom_mm',
          width_mm: '180.00',
          height_mm: '100.00',
        }}
      />,
    );

    const paper = screen.getByRole('region', { name: 'Vista previa de recibo Personalizado' });
    expect(paper).toHaveStyle({ aspectRatio: '180 / 100' });
    expect(paper).toHaveClass('receipt-paper-preview--custom');
    expect(paper).toHaveAttribute('data-receipt-preview-paper', 'custom');
  });

  it('provides a scalable content surface inside the paper container', () => {
    render(
      <ReceiptSettingsPreview
        hospitalName="Hospital San Isidro"
        governmentLine="Gobierno de Honduras"
        secretariatLine="Secretaria de Salud"
        location="Tocoa, Colon"
        footerText="Original: Oficina Recaudadora"
        series={series}
        profile={profile}
        paper="half_letter"
      />,
    );

    const paper = screen.getByRole('region', { name: 'Vista previa de recibo Media carta' });
    expect(paper).toHaveClass('receipt-paper-preview');
    expect(paper).toHaveAttribute('data-receipt-preview-paper', 'half_letter');
    const content = paper.querySelector('[data-receipt-preview-content]');
    expect(content).toHaveClass('receipt-paper-preview__content');
    expect(content).not.toHaveClass('min-h-full');
    expect(content).toHaveAttribute('data-receipt-preview-fit', 'contain');
    expect(paper.querySelector('[data-receipt-preview-table]')).toHaveAttribute('data-receipt-preview-table', 'true');
    expect(paper.querySelector('[data-receipt-preview-signatures]')).toHaveAttribute('data-receipt-preview-signatures', 'true');
    expect(paper.querySelector('[data-receipt-preview-footer]')).toHaveAttribute('data-receipt-preview-footer', 'true');
  });

  it('uses the institutional receipt palette instead of local neutral color utilities', () => {
    render(
      <ReceiptSettingsPreview
        hospitalName="Hospital San Isidro"
        governmentLine="Gobierno de Honduras"
        secretariatLine="Secretaria de Salud"
        location="Tocoa, Colon"
        footerText="Original: Oficina Recaudadora"
        series={series}
        profile={profile}
        paper="half_letter"
      />,
    );

    const paper = screen.getByRole('region', { name: 'Vista previa de recibo Media carta' });
    expect(paper).toHaveClass('bg-receipt-paper', 'text-receipt-ink', 'border-receipt-border-soft');
    expect(paper.innerHTML).not.toMatch(/(?:text|bg|border)-(?:white|black|neutral|amber)(?:-|\b)/);
  });

  it('calculates a contain scale from both real content dimensions', () => {
    expect(calculateReceiptPreviewScale({
      paperWidth: 240,
      paperHeight: 155,
      contentWidth: 768,
      contentHeight: 500,
    })).toBeCloseTo(0.31, 4);

    expect(calculateReceiptPreviewScale({
      paperWidth: 768,
      paperHeight: 497,
      contentWidth: 768,
      contentHeight: 420,
    })).toBe(1);
  });
});
