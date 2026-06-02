import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Dialog } from './dialog';

describe('Dialog accessibility', () => {
  it('exposes the title as the dialog accessible name', () => {
    render(
      <Dialog open={true} onOpenChange={() => undefined} title="Confirmar emision" description="Revise los datos">
        <button>OK</button>
      </Dialog>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName('Confirmar emision');
  });

  it('renders nothing in the document when closed', () => {
    render(
      <Dialog open={false} onOpenChange={() => undefined} title="No debe mostrarse" description="Descripcion">
        <button>OK</button>
      </Dialog>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
