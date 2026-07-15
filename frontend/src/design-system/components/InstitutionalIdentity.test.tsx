import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InstitutionalIdentity } from './InstitutionalIdentity';

describe('InstitutionalIdentity', () => {
  it('uses the canonical institution and marks a missing logo provisional', () => {
    render(
      <InstitutionalIdentity
        hospitalName="Hospital General San Isidro"
        location="Tocoa, Colón, Honduras"
        provisional
      />,
    );

    expect(screen.getByText('Hospital General San Isidro')).toBeVisible();
    expect(screen.getByText('Tocoa, Colón, Honduras')).toBeVisible();
    expect(screen.getByText('Identidad provisional')).toBeVisible();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
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
    expect(screen.queryByText('Identidad provisional')).not.toBeInTheDocument();
  });
});
