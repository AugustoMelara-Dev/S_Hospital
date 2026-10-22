import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { InvoicePreview } from '@/lib/api';
import { deriveCobrarStatus } from '../state/status';
import { SummaryActionZone } from './SummaryActionZone';

function previewFixture(totalCents: number | null): InvoicePreview {
  return {
    status: 'ok',
    currency: 'HNL',
    tax: { label: 'ISV', available: true, rate: '15.00', rate_basis_points: 1500, origin: 'fiscal_settings' },
    totals: {
      subtotal_cents: 1500,
      taxable_base_cents: 1500,
      exempt_cents: 0,
      tax_cents: 225,
      discount_cents: 0,
      total_cents: totalCents,
    },
    zero_reason: null,
    items: [],
    emission: {
      persisted: false,
      invoice_created: false,
      fiscal_number_consumed: false,
      payment_created: false,
      institutional_receipt_created: false,
    },
  };
}

function statusFor(
  preview: InvoicePreview | null,
  overrides: Partial<Parameters<typeof deriveCobrarStatus>[0]> = {},
) {
  return deriveCobrarStatus({
    patientName: 'Paciente Sintético',
    lineCount: 1,
    hasCashSession: true,
    cashSessionLoading: false,
    canCreatePayments: true,
    preview,
    previewing: false,
    previewError: null,
    lineIssue: null,
    previewMatchesRevision: preview !== null,
    submitting: false,
    result: null,
    ...overrides,
  });
}

function renderBar(
  preview: InvoicePreview | null,
  overrides: Partial<Parameters<typeof deriveCobrarStatus>[0]> = {},
) {
  const status = statusFor(preview, overrides);

  render(
    <SummaryActionZone
      status={status}
      preview={preview}
      previewMatchesRevision={preview !== null}
      submitting={false}
      onConfirm={vi.fn()}
      onRetryPreview={vi.fn()}
      canPreviewDocument={preview !== null}
      previewingDocument={false}
      onPreviewDocument={vi.fn()}
    />,
  );

  return status;
}

function totalZone() {
  return screen.getByRole('complementary', { name: /total y acción/i });
}

describe('SummaryActionZone · barra integrada de total y acción', () => {
  it('lee el total valorado por el servidor y su desglose en una sola franja', () => {
    renderBar(previewFixture(1725));

    const zone = totalZone();
    const total = screen.getByText('Total confirmado');

    expect(total.nextElementSibling?.textContent?.trim()).toBe('L. 17.25');
    expect(within(zone).getByText('Subtotal').parentElement).toHaveTextContent('L. 15.00');
    expect(within(zone).getByText(/^ISV/).parentElement).toHaveTextContent('L. 2.25');
    expect(within(zone).getByText('L. 0.00')).toBeVisible();
  });

  it('etiqueta la acción con el total y la habilita solo cuando la cuenta está valorada', () => {
    const status = renderBar(previewFixture(1725));
    const action = screen.getByTestId('cobrar-primary-action');

    expect(status.canConfirm).toBe(true);
    expect(action).toBeEnabled();
    expect(action).toHaveTextContent('Cobrar · L. 17.25');
  });

  it('mantiene una sola superficie y distingue listo de la emisión sin cobro', () => {
    const { unmount } = render(
      <SummaryActionZone
        status={statusFor(previewFixture(1725))}
        preview={previewFixture(1725)}
        previewMatchesRevision
        submitting={false}
        onConfirm={vi.fn()}
        onRetryPreview={vi.fn()}
        canPreviewDocument
        previewingDocument={false}
        onPreviewDocument={vi.fn()}
      />,
    );

    expect(totalZone()).toHaveAttribute('data-cobrar-state', 'listo');
    expect(totalZone().className).toContain('border-[var(--ui-line-strong)]');
    unmount();

    renderBar(previewFixture(0));
    expect(totalZone()).toHaveAttribute('data-cobrar-state', 'sin_cobro');
    expect(totalZone().className).toContain('bg-[var(--ui-surface)]');
    expect(screen.getByTestId('cobrar-primary-action')).toHaveTextContent(/emitir sin cobro/i);
  });

  it('un error de valoración nunca se presenta como L 0.00 y ofrece reintentar', async () => {
    const user = userEvent.setup();
    const onRetryPreview = vi.fn();

    render(
      <SummaryActionZone
        status={statusFor(null, {
          previewError: 'No hay conexión con el servidor local.',
          previewMatchesRevision: false,
        })}
        preview={null}
        previewMatchesRevision={false}
        submitting={false}
        onConfirm={vi.fn()}
        onRetryPreview={onRetryPreview}
        canPreviewDocument={false}
        previewingDocument={false}
        onPreviewDocument={vi.fn()}
      />,
    );

    const zone = totalZone();

    expect(within(zone).getByText('No disponible')).toBeVisible();
    expect(zone.textContent).not.toContain('L. 0.00');
    expect(screen.getByTestId('cobrar-primary-action')).toBeDisabled();

    await user.click(within(zone).getByRole('button', { name: /reintentar valoración/i }));
    expect(onRetryPreview).toHaveBeenCalledTimes(1);
  });

  it('explica el bloqueo con texto, sin depender del color del botón', () => {
    renderBar(previewFixture(1725), { patientName: '' });

    expect(totalZone()).toHaveAttribute('data-cobrar-state', 'invalido');
    expect(screen.getByText(/ingrese el nombre del paciente/i)).toBeVisible();
    expect(screen.getByTestId('cobrar-primary-action')).toBeDisabled();
  });
});
