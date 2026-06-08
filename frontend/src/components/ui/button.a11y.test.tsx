import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { Button } from './button';

describe('Button accessibility', () => {
  it('has no axe-core violations on a default button', async () => {
    const { container } = render(<Button>Aceptar</Button>);

    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders an icon-only button with an accessible name', async () => {
    const { container } = render(
      <Button aria-label="Cerrar sesión">
        <span aria-hidden="true">x</span>
      </Button>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it('reports the disabled state to assistive technologies', async () => {
    const { container } = render(<Button disabled>Deshabilitado</Button>);

    const button = container.querySelector('button');
    expect(button).toBeDisabled();
    expect(await axe(container)).toHaveNoViolations();
  });
});
