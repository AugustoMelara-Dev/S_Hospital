import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './button';

describe('Button contrast during state changes', () => {
  it.each(['default', 'outline'] as const)('restores enabled opacity immediately for %s actions', (variant) => {
    const { rerender } = render(<Button variant={variant} disabled>Buscar</Button>);
    const button = screen.getByRole('button', { name: 'Buscar' });
    expect(button).toBeDisabled();
    expect(button.className).toContain('disabled:opacity-50');
    rerender(<Button variant={variant}>Buscar</Button>);
    expect(button).toBeEnabled();
    const transition = button.className.match(/transition-\[([^\]]+)\]/)?.[1].split(',');
    expect(transition).toBeDefined();
    expect(transition).not.toContain('opacity');
    expect(transition).toContain('background-color');
  });

  it('uses the audited opaque action hover token instead of diluting the primary background', () => {
    render(<Button>Buscar</Button>);
    const button = screen.getByRole('button', { name: 'Buscar' });
    expect(button.className).toContain('hover:bg-[var(--ui-action-hover)]');
    expect(button.className).not.toContain('hover:bg-primary/80');
  });
});
