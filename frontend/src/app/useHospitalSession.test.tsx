import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useHospitalSession } from './useHospitalSession';
import { apiClient } from '../lib/api';

function SessionProbe() {
  const session = useHospitalSession();

  return (
    <output>
      {session.loading ? 'loading' : 'ready'}:{session.sessionExpired ? 'expired' : 'active'}
    </output>
  );
}

describe('useHospitalSession', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('invalidates cached session state when the API reports an expired session', async () => {
    let expireSession: (() => void) | null = null;
    const unsubscribe = vi.fn();

    vi.spyOn(apiClient, 'session').mockResolvedValue(null);
    vi.spyOn(apiClient, 'onSessionExpired').mockImplementation((handler) => {
      expireSession = handler;

      return unsubscribe;
    });
    const invalidateSession = vi.spyOn(apiClient, 'invalidateSession').mockImplementation(() => undefined);

    render(<SessionProbe />);

    await waitFor(() => expect(screen.getByText('ready:active')).toBeInTheDocument());

    act(() => {
      expireSession?.();
    });

    expect(invalidateSession).toHaveBeenCalledTimes(1);
    expect(screen.getByText('ready:expired')).toBeInTheDocument();
  });
});

