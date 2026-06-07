import toast from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notify } from './toaster';

vi.mock('react-hot-toast', () => {
  const toastMock = vi.fn();
  Object.assign(toastMock, {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    promise: vi.fn(),
  });

  return {
    default: toastMock,
    Toaster: vi.fn(() => null),
  };
});

const mockedToast = vi.mocked(toast);
const toastWithHelpers = mockedToast as typeof mockedToast & {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  loading: ReturnType<typeof vi.fn>;
  dismiss: ReturnType<typeof vi.fn>;
  promise: ReturnType<typeof vi.fn>;
};

describe('notify', () => {
  beforeEach(() => {
    notify.dismiss();
    vi.clearAllMocks();
    toastWithHelpers.success.mockImplementation((message: string) => `success-${message}`);
    toastWithHelpers.error.mockImplementation((message: string) => `error-${message}`);
    toastWithHelpers.loading.mockImplementation((message: string) => `loading-${message}`);
    toastWithHelpers.promise.mockReturnValue('promise-id');
    mockedToast.mockImplementation((message) => `info-${String(message)}`);
  });

  it('dismisses older notices after three visible messages', () => {
    notify.success('uno');
    notify.success('dos');
    notify.success('tres');
    notify.success('cuatro');

    expect(toastWithHelpers.dismiss).toHaveBeenCalledTimes(1);
    expect(toastWithHelpers.dismiss).toHaveBeenCalledWith('success-uno');
  });

  it('clears the tracked queue when all notices are dismissed', () => {
    notify.success('uno');
    notify.success('dos');
    notify.dismiss();
    notify.success('tres');
    notify.success('cuatro');
    notify.success('cinco');

    expect(toastWithHelpers.dismiss).toHaveBeenCalledTimes(1);
    expect(toastWithHelpers.dismiss).toHaveBeenCalledWith();
  });

  it('reuses one visible notice for operational status updates', () => {
    notify.status('Cargando respaldos locales...');
    notify.status('Respaldos locales cargados.', 'success');

    expect(mockedToast).toHaveBeenCalledWith('Cargando respaldos locales...', {
      id: 'hospital-status-toast',
      icon: 'i',
    });
    expect(toastWithHelpers.success).toHaveBeenCalledWith('Respaldos locales cargados.', {
      id: 'hospital-status-toast',
    });
    expect(toastWithHelpers.dismiss).not.toHaveBeenCalled();
  });
});
