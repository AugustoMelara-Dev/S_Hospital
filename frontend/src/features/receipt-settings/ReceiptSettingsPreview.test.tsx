import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReceiptSettingsPreview } from './components/ReceiptSettingsPreview';
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
  receipt_number_color: '#b91c1c',
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
    expect(screen.getByText('Servicios hospitalarios de prueba')).toBeInTheDocument();
    expect(screen.getByText('Espacio para sello/firma')).toBeInTheDocument();
    expect(document.body.textContent).toContain('ORIGINAL');
    expect(document.body.textContent).not.toMatch(/CAI|barcode|qr_code|user_id|Estado/);
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
      />,
    );

    expect(screen.getByText('Hospital San Isidro')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Gobierno de Honduras|Secretaria de Salud|Tocoa/);
    expect(screen.getByText(/Copia digital guardada en sistema/)).toBeInTheDocument();
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
      />,
    );

    expect(screen.getByText(/ORIGINAL/)).toBeInTheDocument();
    expect(screen.getByText(/PRIMERA COPIA/)).toBeInTheDocument();
    expect(screen.getByText(/SEGUNDA COPIA/)).toBeInTheDocument();
  });
});
