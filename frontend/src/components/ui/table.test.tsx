import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Table, TableBody, TableCell, TableRow } from './table';

describe('TableCell', () => {
  it('wraps descriptive content while keeping explicitly numeric cells on one line', () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Servicio hospitalario con un nombre deliberadamente extenso</TableCell>
            <TableCell data-numeric="true">L 12,345.67</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const description = screen.getByText(/Servicio hospitalario/);
    const amount = screen.getByText('L 12,345.67');

    expect(description).toHaveClass('min-w-0', 'whitespace-normal', 'break-words');
    expect(amount).toHaveClass('[&[data-numeric=true]]:whitespace-nowrap');
  });
});
