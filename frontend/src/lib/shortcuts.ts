/**
 * Central catalogue of cashier / hospital billing keyboard shortcuts.
 *
 * Each route that wants to advertise its shortcuts imports the
 * relevant entries and renders them in tooltips or the /help page.
 * The catalogue is the single source of truth so that:
 *
 *   1. The help view never drifts from the implementation
 *   2. New screens know which keys are already taken and avoid
 *      collisions inside the cashier workflow
 *   3. Test code can assert that the catalogue is internally
 *      consistent (no duplicate bindings, no missing description)
 */

import type { ReactNode } from 'react';

export type ShortcutScope = 'global' | 'pos' | 'cash' | 'reports' | 'history';

export type ShortcutEntry = {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  scope: ShortcutScope;
  description: string;
};

export const KEYBOARD_SHORTCUTS: ShortcutEntry[] = [
  {
    key: 'n',
    ctrl: true,
    scope: 'pos',
    description: 'Foco en el campo de paciente para iniciar una factura nueva.',
  },
  {
    key: 'b',
    ctrl: true,
    scope: 'pos',
    description: 'Foco en la búsqueda de servicios o en el campo de código escaneable.',
  },
  {
    key: 'F6',
    scope: 'pos',
    description: 'Foco en el campo de escaneo de códigos de barra o QR.',
  },
  {
    key: 'Enter',
    ctrl: true,
    scope: 'pos',
    description: 'Emitir la factura en curso o abrir el dialogo de confirmacion.',
  },
  {
    key: 'Escape',
    scope: 'pos',
    description: 'Limpiar paciente, busqueda y servicios cuando hay algo en curso.',
  },
  {
    key: 'F2',
    scope: 'cash',
    description: 'Abrir caja rapidamente desde la pantalla de caja.',
  },
  {
    key: 'F4',
    scope: 'global',
    description: 'Abrir la pantalla de nueva factura.',
  },
  {
    key: 'F8',
    scope: 'history',
    description: 'Reimprimir la ultima factura del cajero.',
  },
  {
    key: 'k',
    ctrl: true,
    scope: 'global',
    description: 'Buscar en la barra de navegacion superior.',
  },
];

export function shortcutsByScope(scope: ShortcutScope): ShortcutEntry[] {
  return KEYBOARD_SHORTCUTS.filter(
    (shortcut) => shortcut.scope === scope || shortcut.scope === 'global',
  );
}

export type ShortcutLabelProps = {
  entry: Pick<ShortcutEntry, 'key' | 'ctrl' | 'alt' | 'shift'>;
  children?: ReactNode;
};

export function shortcutLabel(entry: Pick<ShortcutEntry, 'key' | 'ctrl' | 'alt' | 'shift'>): string {
  const parts: string[] = [];
  if (entry.ctrl) parts.push('Ctrl');
  if (entry.alt) parts.push('Alt');
  if (entry.shift) parts.push('Shift');
  parts.push(entry.key.toUpperCase());
  return parts.join('+');
}
