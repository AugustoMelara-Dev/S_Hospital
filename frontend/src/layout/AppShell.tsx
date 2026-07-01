import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { type AuthUser, type CashSession } from '../lib/api';
import { useBroadcastSync } from '../lib/realtime/useBroadcastSync';
import { GuidedTour, shouldAutoOpenGuidedTour } from '../features/onboarding/GuidedTour';
import { canAccessPath, getActiveNavigationItem, getBreadcrumbs, getVisibleNavigation } from '../navigation/appNavigation';
import { MobileNavigation } from './components/MobileNavigation';
import { SidebarContent } from './Sidebar';
import { Topbar } from './Topbar';
import { cn } from '../lib/utils';

const SIDEBAR_COLLAPSED_KEY = 's-hospital-sidebar-collapsed';

function readSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeSidebarCollapsed(value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, value ? '1' : '0');
  } catch {
    // localStorage can be unavailable in private mode.
  }
}

type AppShellProps = {
  cashSession: CashSession | null;
  children: React.ReactNode;
  onLogout: () => void;
  status: string;
  user: AuthUser;
  topbarVariant?: 'default' | 'minimal';
  logoUrl?: string | null;
};

export type { AppShellProps };

export function AppShell({
  cashSession,
  children,
  onLogout,
  status,
  user,
  topbarVariant = 'default',
  logoUrl,
}: AppShellProps) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => readSidebarCollapsed());
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);

  // Wire real-time sync (WebSocket/Soketi) when the user is logged in.
  // Mounted once at the shell so every authenticated route benefits
  // from cross-PC invalidations of invoices, dashboard reports and
  // cash session queries.
  useBroadcastSync();

  useEffect(() => {
    if (shouldAutoOpenGuidedTour()) {
      setGuideOpen(true);
    }
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    writeSidebarCollapsed(sidebarCollapsed);
  }, [sidebarCollapsed]);

  const visibleNavigation = getVisibleNavigation(user.permissions);
  const activeItem = getActiveNavigationItem(location.pathname);
  const crumbs = getBreadcrumbs(location.pathname);
  const isMinimalTopbar = topbarVariant === 'minimal';

  return (
    <div className="app-shell min-h-[100dvh] overflow-x-hidden bg-operational-bg text-foreground transition-colors">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:font-bold focus:text-primary-foreground focus:shadow-lg"
      >
        Omitir al contenido principal
      </a>

      <MobileNavigation
        open={mobileMenuOpen}
        onOpenChange={setMobileMenuOpen}
        user={user}
        cashSession={cashSession}
        visibleNavigation={visibleNavigation}
        activeItem={activeItem}
        logoUrl={logoUrl}
        triggerRef={mobileMenuButtonRef}
      />

      <aside
        data-sidebar-collapsed={sidebarCollapsed ? 'true' : 'false'}
        className={cn(
          'print-hidden hidden lg:fixed lg:inset-y-0 lg:z-20 lg:flex lg:flex-col lg:border-r lg:border-sidebar-border lg:bg-sidebar lg:text-sidebar-foreground lg:shadow-operational',
          sidebarCollapsed ? 'lg:w-16' : 'lg:w-72',
        )}
      >
        <SidebarContent
          user={user}
          cashSession={cashSession}
          visibleNavigation={visibleNavigation}
          activeItem={activeItem}
          logoUrl={logoUrl}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
        />
      </aside>

      <div
        data-sidebar-collapsed={sidebarCollapsed ? 'true' : 'false'}
        className={cn('flex min-h-[100dvh] min-w-0 flex-col', sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-72')}
      >
        <Topbar
          cashSession={cashSession}
          user={user}
          status={status}
          isMinimalTopbar={isMinimalTopbar}
          crumbs={crumbs}
          canLinkToBreadcrumb={(path) => canAccessPath(path, user.permissions)}
          mobileMenuButtonRef={mobileMenuButtonRef}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenGuide={() => setGuideOpen(true)}
          onLogout={onLogout}
          onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
          sidebarCollapsed={sidebarCollapsed}
        />

        <main
          id="main-content"
          className="min-w-0 flex-1 scroll-mt-20 px-4 py-5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:px-7 lg:py-7"
          tabIndex={-1}
        >
          <div className="mx-auto flex max-w-[1440px] flex-col gap-5">{children}</div>
        </main>

        <footer className="print-hidden sr-only" aria-live="polite">
          <p role="status">{status}</p>
        </footer>
      </div>
      <GuidedTour open={guideOpen} onOpenChange={setGuideOpen} />
    </div>
  );
}
