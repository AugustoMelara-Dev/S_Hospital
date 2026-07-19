import { SearchIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { KEYBOARD_SHORTCUTS, shortcutLabel, type ShortcutScope } from '@/lib/shortcuts';

type KeyboardShortcutsPaletteProps = { open: boolean; onOpenChange: (open: boolean) => void };

const SCOPES: Array<{ id: ShortcutScope; label: string; description: string }> = [
  { id: 'global', label: 'Global', description: 'Atajos disponibles en cualquier pantalla.' },
  { id: 'pos', label: 'Punto de venta', description: 'Facturación y cobro.' },
  { id: 'cash', label: 'Caja', description: 'Apertura, cierre y movimientos.' },
  { id: 'history', label: 'Historial', description: 'Búsqueda y reimpresión de facturas.' },
  { id: 'reports', label: 'Reportes', description: 'Filtros y exportación.' },
];

export function KeyboardShortcutsPalette({ open, onOpenChange }: KeyboardShortcutsPaletteProps) {
  const [filter, setFilter] = useState('');
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(open);

  useEffect(() => { if (!open) setFilter(''); }, [open]);

  useEffect(() => {
    if (!wasOpenRef.current && open) {
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    if (wasOpenRef.current && !open) {
      window.setTimeout(() => previousFocusRef.current?.focus(), 0);
    }
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target instanceof HTMLElement ? event.target : document.body;
      if (['input', 'textarea', 'select'].includes(target.tagName.toLowerCase()) || target.isContentEditable) return;
      const isOpen = document.querySelector('[data-shortcuts-palette="open"]') !== null;
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
    ? KEYBOARD_SHORTCUTS.filter((entry) => entry.description.toLowerCase().includes(normalizedFilter)
      || shortcutLabel(entry).toLowerCase().includes(normalizedFilter)
      || entry.scope.toLowerCase().includes(normalizedFilter))
    : KEYBOARD_SHORTCUTS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" data-shortcuts-palette={open ? 'open' : 'closed'}>
        <DialogHeader>
          <DialogTitle>Atajos de teclado</DialogTitle>
          <DialogDescription>Pulsa ? para abrir esta paleta y Esc para cerrar.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Buscar atajo de teclado" autoComplete="off" className="pl-9" onChange={(event) => setFilter(event.target.value)} placeholder="Buscar atajo..." type="search" value={filter} />
          </div>
          {filter ? <Button variant="outline" onClick={() => setFilter('')}><XIcon /> Limpiar</Button> : null}
        </div>
        <div className="flex max-h-96 flex-col gap-5 overflow-y-auto pr-1" role="region" aria-label="Atajos disponibles" tabIndex={0}>
          {SCOPES.map((scope) => {
            const entries = filteredShortcuts.filter((entry) => entry.scope === scope.id);
            if (entries.length === 0) return null;
            return (
              <section key={scope.id} aria-labelledby={`shortcuts-scope-${scope.id}`} className="flex flex-col gap-2">
                <div><h3 id={`shortcuts-scope-${scope.id}`} className="font-semibold">{scope.label}</h3><p className="text-sm text-muted-foreground">{scope.description}</p></div>
                <ul className="flex flex-col gap-1">
                  {entries.map((entry) => (
                    <li key={`${entry.scope}-${entry.key}-${entry.ctrl ? 'ctrl' : ''}`} className="flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 hover:bg-muted">
                      <span className="text-sm text-muted-foreground">{entry.description}</span>
                      <kbd className="rounded-md border bg-muted px-2 py-1 font-mono text-xs">{shortcutLabel(entry)}</kbd>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {filteredShortcuts.length === 0 ? <Empty><EmptyHeader><EmptyTitle>Sin resultados</EmptyTitle><EmptyDescription>No se encontraron atajos para «{filter}».</EmptyDescription></EmptyHeader></Empty> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
