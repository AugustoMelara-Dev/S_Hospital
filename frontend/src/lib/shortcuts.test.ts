import { describe, expect, it } from 'vitest';
import { KEYBOARD_SHORTCUTS, shortcutLabel, shortcutsByScope } from './shortcuts';

describe('keyboard shortcuts catalogue', () => {
  it('exposes a non-empty catalogue', () => {
    expect(KEYBOARD_SHORTCUTS.length).toBeGreaterThan(0);
  });

  it('has a description for every entry', () => {
    for (const entry of KEYBOARD_SHORTCUTS) {
      expect(entry.description, `Missing description for key ${entry.key}`).toBeTruthy();
      expect(entry.description.length).toBeGreaterThan(8);
    }
  });

  it('does not bind the same key twice inside the same scope with identical modifiers', () => {
    const seen = new Set<string>();

    for (const entry of KEYBOARD_SHORTCUTS) {
      const signature = `${entry.scope}|${entry.ctrl ? 'ctrl+' : ''}${entry.alt ? 'alt+' : ''}${entry.shift ? 'shift+' : ''}${entry.key.toLowerCase()}`;
      expect(seen.has(signature), `Duplicate shortcut binding: ${signature}`).toBe(false);
      seen.add(signature);
    }
  });

  it('includes at least one global shortcut for navigation', () => {
    const global = KEYBOARD_SHORTCUTS.filter((shortcut) => shortcut.scope === 'global');
    expect(global.length).toBeGreaterThan(0);
  });

  it('lists POS shortcuts in the pos scope', () => {
    const pos = shortcutsByScope('pos');
    expect(pos.some((entry) => entry.key.toLowerCase() === 'n' && entry.ctrl)).toBe(true);
    expect(pos.some((entry) => entry.key.toLowerCase() === 'b' && entry.ctrl)).toBe(true);
    expect(pos.some((entry) => entry.key === 'Escape')).toBe(true);
  });

  it('renders labels in Ctrl+Key form', () => {
    expect(shortcutLabel({ key: 'n', ctrl: true })).toBe('Ctrl+N');
    expect(shortcutLabel({ key: 'F4' })).toBe('F4');
    expect(shortcutLabel({ key: 'Enter', ctrl: true, shift: true })).toBe('Ctrl+Shift+ENTER');
  });
});
