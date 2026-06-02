import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { OpenSessionForm } from './OpenSessionForm';

vi.mock('react-hook-form', () => ({
  useForm: () => ({
    register: (name: string) => ({
      name,
      onChange: () => undefined,
      onBlur: () => undefined,
      ref: () => undefined,
    }),
    handleSubmit: (cb: unknown) => () => cb,
    formState: { errors: {} },
  }),
}));

describe('OpenSessionForm accessibility', () => {
  it('has no axe-core violations on the default render', async () => {
    const { container } = render(
      <OpenSessionForm isSubmitting={false} onSubmit={() => undefined} />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it('exposes the opening amount input with an associated label', () => {
    render(<OpenSessionForm isSubmitting={false} onSubmit={() => undefined} />);

    const input = screen.getByLabelText(/monto inicial/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('inputmode', 'decimal');
  });

  it('marks the submit button as busy when the form is submitting', () => {
    render(<OpenSessionForm isSubmitting={true} onSubmit={() => undefined} />);

    const button = screen.getByRole('button', { name: /abriendo/i });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });
});
