import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedValue } from './useDebouncedValue';

describe('useDebouncedValue', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('devuelve el valor inicial de inmediato (la primera consulta no se retrasa)', () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useDebouncedValue('glucosa', 250));

    expect(result.current).toBe('glucosa');
  });

  it('agrupa la ráfaga y sólo emite el último valor tras el silencio', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 250),
      { initialProps: { value: '' } },
    );

    rerender({ value: 'g' });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ value: 'gl' });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ value: 'glu' });
    expect(result.current).toBe('');

    act(() => {
      vi.advanceTimersByTime(249);
    });
    expect(result.current).toBe('');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('glu');
  });
});
