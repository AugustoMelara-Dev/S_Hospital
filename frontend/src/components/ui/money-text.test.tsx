import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MoneyText } from './money-text';

describe('MoneyText', () => {
  it('formats cent amounts as Lempiras with tabular numbers', () => {
    render(<MoneyText amountCents={123456} />);

    const amount = screen.getByText('L. 1,234.56');
    expect(amount).toHaveClass('tabular-nums');
    expect(amount).toHaveAttribute('translate', 'no');
  });
});

