import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('renders the bootstrap placeholder', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /backend y frontend listos/i })).toBeInTheDocument();
    expect(screen.getByText('/invoices · Fase 4')).toBeInTheDocument();
  });
});

