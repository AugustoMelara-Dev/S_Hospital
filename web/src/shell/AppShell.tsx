import { Suspense, useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router';
import { usePermissions } from '@/auth/hooks';
import { Spinner } from '@/ui/Spinner';
import { CommandPalette } from './CommandPalette';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

/** Fired on F2 so /cobrar can reset and focus "Nombre del paciente" even if already mounted. */
export const NEW_OPERATION_EVENT = 'shs:new-operation';

export function PageFallback() {
  return (
    <div className="flex justify-center py-20 text-ink-3" role="status">
      <Spinner className="size-5" />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}

export function AppShell() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canCreate = can('invoices.create');

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (e.key === 'F2' && canCreate) {
        e.preventDefault();
        setPaletteOpen(false);
        navigate('/cobrar', { state: { focus: 'patient', at: Date.now() } });
        window.dispatchEvent(new CustomEvent(NEW_OPERATION_EVENT));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, canCreate]);

  return (
    <div className="min-h-dvh pl-[var(--sidebar-w)]">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-[var(--radius-sm)] bg-brand px-3 py-2 text-brand-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Saltar al contenido
      </a>
      <Sidebar />
      <TopBar onOpenPalette={() => setPaletteOpen(true)} />
      <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-[var(--content-max)] px-4 py-6 outline-none md:px-8">
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
