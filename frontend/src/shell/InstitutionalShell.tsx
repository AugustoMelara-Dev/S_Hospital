import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { KeyboardShortcutsPalette } from '../components/keyboard-shortcuts-palette';
import { GuidedTour, shouldAutoOpenGuidedTour } from '../features/onboarding/GuidedTour';
import { usePublicBranding } from '../hooks/useFiscalSettings';
import { type AuthUser, type CashSession } from '../lib/api';
import { displayHospitalName } from '../lib/hospital-name';
import { useBroadcastSync } from '../lib/realtime/useBroadcastSync';
import { cn } from '../lib/utils';
import { getActiveNavigationItem, getBreadcrumbs, getVisibleNavigation } from '../navigation/appNavigation';
import { InstitutionalMobileNav } from './navigation/InstitutionalMobileNav';
import { InstitutionalRail } from './navigation/InstitutionalRail';
import { CommandPalette } from './navigation/CommandPalette';
import { ContextBar } from './status/ContextBar';

const RAIL_PREFERENCE_KEY = 's-hospital-institutional-rail:v1';

export type InstitutionalShellProps = {
  cashSession: CashSession | null;
  children: ReactNode;
  logoUrl?: string | null;
  onLogout: () => void;
  status: string;
  user: AuthUser;
};

function readRailCollapsed() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(RAIL_PREFERENCE_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

function writeRailCollapsed(collapsed: boolean) {
  try {
    window.localStorage.setItem(RAIL_PREFERENCE_KEY, collapsed ? 'collapsed' : 'expanded');
  } catch {
    // Storage can be unavailable in hardened or private browser sessions.
  }
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return ['input', 'textarea', 'select'].includes(target.tagName.toLowerCase())
    || target.isContentEditable
    || target.contentEditable === 'true';
}

export function InstitutionalShell({ cashSession, children, logoUrl, onLogout, status, user }: InstitutionalShellProps) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(readRailCollapsed);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const commandButtonRef = useRef<HTMLButtonElement>(null);
  const { data: branding } = usePublicBranding();
  const hospitalName = displayHospitalName(branding?.hospital_name);

  useBroadcastSync();

  const visibleNavigation = getVisibleNavigation(user.permissions);
  const activeItem = getActiveNavigationItem(location.pathname);
  const crumbs = getBreadcrumbs(location.pathname);

  useEffect(() => {
    if (shouldAutoOpenGuidedTour()) setGuideOpen(true);
  }, []);

  useEffect(() => {
    setCommandsOpen(false);
    setMobileOpen(false);
    window.scrollTo({ behavior: 'auto', left: 0, top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandsOpen((current) => !current);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      writeRailCollapsed(next);
      return next;
    });
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-background text-foreground">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        Omitir al contenido principal
      </a>

      <InstitutionalRail activeItem={activeItem} collapsed={collapsed} hospitalName={hospitalName} logoUrl={logoUrl} navigation={visibleNavigation} onToggleCollapsed={toggleCollapsed} />

      <div className={cn('flex min-h-screen min-w-0 flex-col pb-16 lg:pb-0', collapsed ? 'lg:ml-20' : 'lg:ml-56')}>
        <ContextBar
          cashSession={cashSession}
          commandButtonRef={commandButtonRef}
          crumbs={crumbs}
          hospitalName={hospitalName}
          onLogout={onLogout}
          onOpenCommands={() => setCommandsOpen(true)}
          onOpenGuide={() => setGuideOpen(true)}
          status={status}
          user={user}
        />
        <main id="main-content" data-audit-panel="content" tabIndex={-1} className="min-w-0 flex-1 scroll-mt-20 px-3 py-4 outline-none sm:px-5 lg:px-7 lg:py-6 xl:px-8">
          <div className="mx-auto flex max-w-screen-2xl flex-col gap-5">{children}</div>
        </main>
        <footer className="print-hidden sr-only">Sistema hospitalario local</footer>
      </div>

      <InstitutionalMobileNav activeItem={activeItem} navigation={visibleNavigation} onOpenChange={setMobileOpen} open={mobileOpen} />
      <CommandPalette navigation={visibleNavigation} onOpenChange={setCommandsOpen} open={commandsOpen} user={user} />
      <GuidedTour open={guideOpen} onOpenChange={setGuideOpen} />
      <KeyboardShortcutsPalette open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}
