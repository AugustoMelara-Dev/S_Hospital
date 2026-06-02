import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import { BackupStatusBadge } from './BackupStatusBadge';

describe('BackupStatusBadge accessibility', () => {
  it('renders each status with a meaningful accessible name', () => {
    const { container: pending } = render(<BackupStatusBadge status="pending" />);
    const { container: success } = render(<BackupStatusBadge status="success" />);
    const { container: failed } = render(<BackupStatusBadge status="failed" />);

    expect(pending.textContent).toMatch(/pendiente/i);
    expect(success.textContent).toMatch(/protegido/i);
    expect(failed.textContent).toMatch(/error/i);
  });

  it('has no axe-core violations on the pending status render', async () => {
    const { container } = render(<BackupStatusBadge status="pending" />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe-core violations on the success status render', async () => {
    const { container } = render(<BackupStatusBadge status="success" />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
