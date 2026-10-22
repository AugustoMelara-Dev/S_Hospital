import { useRef, useState, type ReactNode } from 'react';
import { MenuIcon, XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { usePublicBranding } from '@/hooks/useFiscalSettings';
import { useAdminFocusRequest } from '@/hooks/useAdminFocusRequest';
import { UnsavedChangesGuardProvider } from '@/hooks/useUnsavedChangesGuard';
import { displayHospitalName } from '@/lib/hospital-name';
import { useBroadcastSync } from '@/lib/realtime/useBroadcastSync';
import { type AuthUser, type CashSession } from '@/lib/api';
import { CommandPalette } from './CommandPalette';
import { AdminSidebar } from './AdminSidebar';

export type AdminShellProps = {
  cashSession: CashSession | null;
  cashSessionLoading?: boolean;
  children: ReactNode;
  logoUrl?: string | null;
  onLogout: () => void;
  status: string;
  user: AuthUser;
};

/**
 * Shell del panel administrativo: navegación lateral con icono y texto en
 * escritorio, cajón en móvil, contenido con ancho de lectura. Sustituye la
 * barra superior y la franja técnica permanente de la identidad anterior.
 */
export function AdminShell({
  cashSession,
  cashSessionLoading = false,
  children,
  logoUrl,
  onLogout,
  status,
  user,
}: AdminShellProps) {
  const { data: branding } = usePublicBranding();
  const hospitalName = displayHospitalName(branding?.hospital_name);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // El disparador del cajón es un botón propio (no un `DialogPrimitive.Trigger`),
  // así que Radix no tiene referencia a la que devolver el foco al cerrar y lo
  // dejaba en `<body>`. Se guarda la referencia y se restaura explícitamente en
  // `onCloseAutoFocus` (medido en navegador: C3-U2).
  const mobileNavTriggerRef = useRef<HTMLButtonElement | null>(null);

  useBroadcastSync();

  // Resuelve el foco pedido por la command palette tras navegar a una vista lazy.
  useAdminFocusRequest();

  // Identidad dark única: el tema lo fija ThemeProvider (clase .dark siempre
  // presente); el shell no conserva control ni fuerza de tema — no hay toggle
  // de usuario ni estado claro heredable.

  // El cajón móvil se cierra con Escape y bloquea el scroll del documento.
  // Radix (Dialog modal) ya aporta ambas cosas junto con la trampa de foco; el
  // efecto local se retiró para no duplicar ni pisar ese comportamiento
  // (C2-R1: el marcado propio dejaba el fondo tabulable).

  const sidebarProps = {
    cashSession,
    cashSessionLoading,
    hospitalName,
    logoUrl,
    onLogout,
    user,
  };

  return (
    <UnsavedChangesGuardProvider>
      <div className="ui-root flex min-h-dvh">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--ui-radius-control)] focus:bg-[var(--ui-action)] focus:px-3 focus:py-2 focus:text-[length:var(--ui-text-base)] focus:font-semibold focus:text-[color:var(--ui-action-foreground)]"
        >
          Omitir al contenido principal
        </a>

        {/* Navegación de escritorio: fija, con ancho estable. */}
        <aside className="print-hidden sticky top-0 hidden h-dvh w-56 shrink-0 border-r border-[var(--ui-action-subtle-strong)] lg:block">
          <AdminSidebar {...sidebarProps} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Cabecera compacta solo en móvil: marca, menú y usuario. */}
          <header className="print-hidden sticky top-0 z-30 flex h-[var(--ui-shell-h)] items-center gap-2 border-b border-[var(--ui-line)] bg-[var(--ui-surface)] px-3 lg:hidden">
            <button
              type="button"
              data-ui-press
              ref={mobileNavTriggerRef}
              onClick={() => setMobileNavOpen(true)}
              aria-label="Abrir navegación"
              aria-expanded={mobileNavOpen}
              className="inline-flex size-11 items-center justify-center rounded-[var(--ui-radius-control)] text-[color:var(--ui-ink)] hover:bg-[var(--ui-surface-alt)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]"
            >
              <MenuIcon aria-hidden="true" data-icon className="size-5" />
            </button>
            <span className="min-w-0 flex-1 truncate text-[length:var(--ui-text-base)] font-semibold text-[color:var(--ui-ink)]">
              {hospitalName}
            </span>
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--ui-surface-alt)] text-[length:var(--ui-text-xs)] font-semibold text-[color:var(--ui-ink-soft)]"
            >
              {user.name.slice(0, 2).toUpperCase()}
            </span>
          </header>

          <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto w-full max-w-[96rem] flex-1 px-4 py-5 outline-none sm:px-6 lg:px-8 lg:py-8"
          >
            {/*
             * Aviso operativo local. Vive en el área de contenido —no en la
             * barra lateral— para que un mensaje largo nunca consuma la altura
             * de la navegación ni tape sus últimas entradas (V12). El espacio se
             * reserva solo mientras hay mensaje.
             */}
            {status ? (
              <p
                role="status"
                aria-live="polite"
                className="mb-4 rounded-[var(--ui-radius-control)] border border-[var(--ui-line)] bg-[var(--ui-surface-alt)] px-3 py-2 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]"
              >
                {status}
              </p>
            ) : null}
            {children}
          </main>

          <footer className="print-hidden border-t border-[var(--ui-line)] px-4 py-3 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-faint)]">
            Sistema hospitalario local · {hospitalName}
          </footer>
        </div>

        {/*
         * Cajón móvil con Radix Dialog, no un `role="dialog"` casero.
         *
         * C2-R1 (MEDIUM): el marcado anterior declaraba `aria-modal="true"` sin
         * trampa de foco, sin foco inicial, sin restauración del foco y sin
         * aislar el fondo, así que todo el contenido de atrás seguía siendo
         * tabulable tras el scrim. Radix aporta trampa de foco, foco inicial,
         * Escape, restauración e `inert` del resto del documento. El movimiento
         * lo siguen aportando los tokens (`data-slot='sheet-*'`, styles.css).
         * El mismo `AdminSidebar` se reutiliza sin duplicar marcado.
         */}
        <DialogPrimitive.Root open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay
              data-slot="sheet-overlay"
              className="print-hidden fixed inset-0 z-50 bg-[var(--ui-scrim)] lg:hidden"
            />
            {/*
             * `ui-portal` es el mismo contrato que AdminDialog y CommandPalette
             * aplican a su contenido portaleado: Radix saca el cajón de
             * `.ui-root`, así que ni la tinta/tipografía ni el anillo de foco de
             * `.ui-root` lo alcanzaban y los tabstops del cajón pintaban
             * `outline-style: none` (la utilidad `outline-none` del `focusRing`
             * vive en la capa `utilities` y le gana a la regla de `@layer base`).
             * Con la clase, la regla **sin capa** de `tokens.css`
             * (`.ui-portal ... :focus-visible`) vuelve a ganar y el anillo admin
             * de 2 px `--ui-focus` queda visible con contraste 7.73:1 sobre
             * surface (WCAG 2.4.7 / 1.4.11). Medido antes/después en la sonda §6.
             */}
            <DialogPrimitive.Content
              data-slot="sheet-content"
              data-side="left"
              onCloseAutoFocus={(event) => {
                // Devuelve el foco al botón que abrió el cajón. Radix solo puede
                // restaurarlo a un `DialogPrimitive.Trigger`; este disparador es un
                // botón propio de la cabecera móvil.
                event.preventDefault();
                mobileNavTriggerRef.current?.focus();
              }}
              className="ui-portal print-hidden fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-[var(--ui-line)] bg-[var(--ui-surface)] shadow-xl outline-none lg:hidden"
            >
              <DialogPrimitive.Title className="sr-only">Navegación</DialogPrimitive.Title>
              <DialogPrimitive.Description className="sr-only">
                Accesos del panel: operación y administración.
              </DialogPrimitive.Description>
              <div className="flex justify-end p-2">
                <DialogPrimitive.Close asChild>
                  <button
                    type="button"
                    data-ui-press
                    aria-label="Cerrar navegación"
                    className="inline-flex size-11 items-center justify-center rounded-[var(--ui-radius-control)] text-[color:var(--ui-ink-soft)] hover:bg-[var(--ui-surface-alt)] hover:text-[color:var(--ui-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]"
                  >
                    <XIcon aria-hidden="true" data-icon className="size-4" />
                  </button>
                </DialogPrimitive.Close>
              </div>
              <AdminSidebar
                {...sidebarProps}
                className="min-h-0 flex-1 pt-0"
                onNavigate={() => setMobileNavOpen(false)}
              />
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>

        <CommandPalette />
      </div>
    </UnsavedChangesGuardProvider>
  );
}
