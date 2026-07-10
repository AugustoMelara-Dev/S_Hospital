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
import { ClinicalMobileNav } from './navigation/ClinicalMobileNav';
import { ClinicalRail } from './navigation/ClinicalRail';
import { CommandPalette } from './navigation/CommandPalette';
import { ContextBar } from './status/ContextBar';

const RAIL_PREFERENCE_KEY = 's-hospital-clinical-rail:v1';

export type ClinicalShellProps = {
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

export function ClinicalShell({ cashSession, children, logoUrl, onLogout, status, user }: ClinicalShellProps) {
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
    <div className="min-h-[100dvh] overflow-x-hidden bg-background text-foreground">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        Omitir al contenido principal
      </a>

      <ClinicalRail activeItem={activeItem} collapsed={collapsed} hospitalName={hospitalName} logoUrl={logoUrl} navigation={visibleNavigation} onToggleCollapsed={toggleCollapsed} user={user} />

      <div className={cn('flex min-h-[100dvh] min-w-0 flex-col pb-16 transition-[margin] duration-200 lg:pb-0', collapsed ? 'lg:ml-[76px]' : 'lg:ml-[264px]')}>
        <ContextBar
          cashSession={cashSession}
          commandButtonRef={commandButtonRef}
          crumbs={crumbs}
          hospitalName={hospitalName}
          onLogout={onLogout}
          onOpenCommands={() => setCommandsOpen(true)}
          onOpenGuide={() => setGuideOpen(true)}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          status={status}
          user={user}
        />
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 scroll-mt-24 px-3 py-4 outline-none sm:px-6 lg:px-8 lg:py-7 xl:px-10">
          <div className="mx-auto flex max-w-[1500px] flex-col gap-6">{children}</div>
        </main>
        <footer className="print-hidden sr-only">Sistema hospitalario local</footer>
      </div>

      <ClinicalMobileNav activeItem={activeItem} navigation={visibleNavigation} onOpenChange={setMobileOpen} open={mobileOpen} />
      <CommandPalette navigation={visibleNavigation} onOpenChange={setCommandsOpen} open={commandsOpen} user={user} />
      <GuidedTour open={guideOpen} onOpenChange={setGuideOpen} />
      <KeyboardShortcutsPalette open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}
