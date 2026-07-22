import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InstitutionalIdentity } from './InstitutionalIdentity';

describe('InstitutionalIdentity', () => {
  it('keeps the fallback monogram legible on the receipt-paper surface in every theme', () => {
    render(<InstitutionalIdentity hospitalName="Hospital General San Isidro" location="Tocoa, Colón" provisional />);

    expect(screen.getByText('HGSI')).toHaveClass('text-receipt-ink');
  });

  it('uses the canonical institution without exposing setup language in ordinary screens', () => {
    render(
      <InstitutionalIdentity
        hospitalName="Hospital General San Isidro"
        location="Tocoa, Colón, Honduras"
        provisional
      />,
    );

    expect(screen.getByText('Hospital General San Isidro')).toBeVisible();
    expect(screen.getByText('Tocoa, Colón, Honduras')).toBeVisible();
    expect(screen.queryByText(/identidad provisional/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('offers a direct logo setup hint only when the caller requests it', () => {
    render(
      <InstitutionalIdentity
        hospitalName="Hospital General San Isidro"
        location="Tocoa, Colón, Honduras"
        provisional
        showSetupHint
      />,
    );

    expect(screen.getByText('Agregue el logotipo oficial')).toBeVisible();
  });

  it('reserves a stable box for an uploaded official logo', () => {
    render(
      <InstitutionalIdentity
        hospitalName="Hospital General San Isidro"
        location="Tocoa, Colón, Honduras"
        logoUrl="/api/settings/logo/file"
      />,
    );

    expect(screen.getByRole('img', { name: /hospital general san isidro/i }).parentElement)
      .toHaveClass('institutional-logo-box');
    expect(screen.queryByText(/identidad provisional|agregue el logotipo/i)).not.toBeInTheDocument();
  });
});
