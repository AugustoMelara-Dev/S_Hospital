import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('does not trigger global shortcuts while a dialog is open', () => {
    const action = vi.fn();
    document.body.innerHTML = '<div role="dialog" data-state="open"><button>Confirmar</button></div>';

    renderHook(() => useKeyboardShortcuts([
      { key: 'Enter', action, description: 'Confirmar' },
    ]));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(action).not.toHaveBeenCalled();
  });

  it('triggers shortcuts when focus is outside editable or composite controls', () => {
    const action = vi.fn();

    renderHook(() => useKeyboardShortcuts([
      { key: 'F4', action, description: 'Cobrar' },
    ]));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F4' }));

    expect(action).toHaveBeenCalledOnce();
  });
});
