import { useCallback, useEffect } from 'react';

type KeyboardShortcut = {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  action: () => void;
  description: string;
};

/**
 * Hook for global keyboard shortcuts in the POS/hospital billing app.
 * Shortcuts are disabled when the user is typing in an input, textarea, or select.
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : document.body;
      const tagName = target.tagName.toLowerCase();
      const isEditable = target.isContentEditable;

      // Don't trigger shortcuts when typing or when composite UI is open.
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || isEditable || hasOpenCompositeUi(target)) {
        return;
      }

      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()
          || event.code.toLowerCase() === shortcut.key.toLowerCase();

        if (
          keyMatch &&
          !!shortcut.ctrl === (event.ctrlKey || event.metaKey) &&
          !!shortcut.alt === event.altKey &&
          !!shortcut.shift === event.shiftKey
        ) {
          event.preventDefault();
          shortcut.action();
          return;
        }
      }
    },
    [shortcuts],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

function hasOpenCompositeUi(target: HTMLElement): boolean {
  if (target.closest('[role="dialog"], [role="menu"], [role="listbox"], [role="combobox"]')) {
    return true;
  }

  return document.querySelector(
    '[data-state="open"][role="dialog"], [data-state="open"][role="menu"], [data-state="open"][role="listbox"], [aria-expanded="true"][role="combobox"]',
  ) !== null;
}

/**
 * Returns a human-readable label for a keyboard shortcut.
 */
export function shortcutLabel(shortcut: Pick<KeyboardShortcut, 'key' | 'ctrl' | 'alt' | 'shift'>): string {
  const parts: string[] = [];
  if (shortcut.ctrl) parts.push('Ctrl');
  if (shortcut.alt) parts.push('Alt');
  if (shortcut.shift) parts.push('Shift');
  parts.push(shortcut.key.toUpperCase());
  return parts.join('+');
}
