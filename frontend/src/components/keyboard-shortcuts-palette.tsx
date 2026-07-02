import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { KEYBOARD_SHORTCUTS, shortcutLabel, type ShortcutScope } from '@/lib/shortcuts';

type KeyboardShortcutsPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SCOPES: Array<{ id: ShortcutScope; label: string; description: string }> = [
  { id: 'global', label: 'Global', description: 'Atajos disponibles en cualquier pantalla.' },
  { id: 'pos', label: 'Punto de venta', description: 'Facturación y cobro.' },
  { id: 'cash', label: 'Caja', description: 'Apertura, cierre y movimientos.' },
  { id: 'history', label: 'Historial', description: 'Búsqueda y reimpresión de facturas.' },
  { id: 'reports', label: 'Reportes', description: 'Filtros y exportación.' },
];

export function KeyboardShortcutsPalette({ open, onOpenChange }: KeyboardShortcutsPaletteProps) {
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!open) {
      setFilter('');
    }
  }, [open]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target instanceof HTMLElement ? event.target : document.body;
      const tagName = target.tagName.toLowerCase();
      const isEditable = target.isContentEditable;

      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || isEditable) {
        return;
      }

      const isOpen = document.querySelector('[data-shortcuts-palette="open"]') !== null;
      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        onOpenChange(false);
        return;
      }

      if (event.key === '?' && !event.ctrlKey && !event.altKey && !event.metaKey) {
        event.preventDefault();
        onOpenChange(!isOpen);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenChange]);

  const normalizedFilter = filter.trim().toLowerCase();
  const filteredShortcuts = normalizedFilter
    ? KEYBOARD_SHORTCUTS.filter((entry) =>
        entry.description.toLowerCase().includes(normalizedFilter) ||
        shortcutLabel(entry).toLowerCase().includes(normalizedFilter) ||
        entry.scope.toLowerCase().includes(normalizedFilter),
      )
    : KEYBOARD_SHORTCUTS;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title="Atajos de teclado"
      description="Pulsa ? en cualquier momento para abrir esta paleta. Pulsa Esc para cerrar."
    >
      <div data-shortcuts-palette={open ? 'open' : 'closed'} className="space-y-4">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Buscar atajo..."
            aria-label="Buscar atajo de teclado"
            className="pl-9"
            autoComplete="off"
          />
          {filter && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 size-7 -translate-y-1/2"
              onClick={() => setFilter('')}
              aria-label="Limpiar filtro de atajos"
            >
              <X aria-hidden="true" className="size-4" />
            </Button>
          )}
        </div>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {SCOPES.map((scope) => {
            const scopeShortcuts = filteredShortcuts.filter(
              (entry) => entry.scope === scope.id,
            );
            if (scopeShortcuts.length === 0) {
              return null;
            }
            return (
              <section
                key={scope.id}
                aria-labelledby={`shortcuts-scope-${scope.id}`}
                className="rounded-md border border-operational-border bg-operational-panel/40 p-3"
              >
                <header className="mb-2">
                  <h3
                    id={`shortcuts-scope-${scope.id}`}
                    className="text-sm font-semibold text-foreground"
                  >
                    {scope.label}
                  </h3>
                  <p className="text-xs text-muted-foreground">{scope.description}</p>
                </header>
                <ul className="space-y-1">
                  {scopeShortcuts.map((entry) => (
                    <li
                      key={`${entry.scope}-${entry.key}-${entry.ctrl ? 'ctrl' : ''}`}
                      className="flex items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-sm hover:bg-muted/40"
                    >
                      <span className="text-muted-foreground">{entry.description}</span>
                      <kbd
                        className={cn(
                          'inline-flex items-center gap-1 rounded border border-operational-border bg-card px-2 py-0.5',
                          'font-mono text-xs font-semibold text-foreground shadow-sm',
                        )}
                        aria-label={shortcutLabel(entry)}
                      >
                        {shortcutLabel(entry)}
                      </kbd>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {filteredShortcuts.length === 0 && (
            <p className="rounded-md border border-dashed border-operational-border bg-operational-panel/20 p-4 text-center text-sm text-muted-foreground">
              No se encontraron atajos para «{filter}».
            </p>
          )}
        </div>
      </div>
    </Dialog>
  );
}