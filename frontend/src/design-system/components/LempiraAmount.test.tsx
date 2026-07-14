import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LempiraAmount } from './LempiraAmount';

describe('LempiraAmount', () => {
  it('renders cents as a non-translatable tabular Lempira amount', () => {
    render(<LempiraAmount cents={123456} />);

    const amount = screen.getByText('L 1,234.56');
    expect(amount).toHaveClass('tabular-nums');
    expect(amount).toHaveAttribute('translate', 'no');
  });
});
