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
      const target = event.target as HTMLElement;
      const tagName = target.tagName.toLowerCase();
      const isEditable = target.isContentEditable;

      // Don't trigger shortcuts when typing in form fields
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || isEditable) {
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
