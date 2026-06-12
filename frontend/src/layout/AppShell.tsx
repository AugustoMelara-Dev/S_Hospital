import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { type AuthUser, type CashSession } from '../lib/api';
import { useBroadcastSync } from '../lib/realtime/useBroadcastSync';
import { GuidedTour, shouldAutoOpenGuidedTour } from '../features/onboarding/GuidedTour';
import { getActiveNavigationItem, getBreadcrumbs, getVisibleNavigation } from '../navigation/appNavigation';
import { MobileSidebar, SidebarContent } from './Sidebar';
import { Topbar } from './Topbar';

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

  const visibleNavigation = getVisibleNavigation(user.permissions);
  const activeItem = getActiveNavigationItem(location.pathname);
  const crumbs = getBreadcrumbs(location.pathname);
  const isMinimalTopbar = topbarVariant === 'minimal';

  return (
    <div className="app-shell min-h-screen bg-background text-foreground transition-colors">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:font-bold focus:text-primary-foreground focus:shadow-lg"
      >
        Omitir al contenido principal
      </a>

      <MobileSidebar
        open={mobileMenuOpen}
        onOpenChange={setMobileMenuOpen}
        user={user}
        cashSession={cashSession}
        visibleNavigation={visibleNavigation}
        activeItem={activeItem}
        logoUrl={logoUrl}
      />

      <aside className="print-hidden hidden lg:fixed lg:inset-y-0 lg:z-20 lg:flex lg:w-64 lg:flex-col">
        <SidebarContent
          user={user}
          cashSession={cashSession}
          visibleNavigation={visibleNavigation}
          activeItem={activeItem}
          logoUrl={logoUrl}
        />
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col lg:ml-64">
        <Topbar
          user={user}
          status={status}
          isMinimalTopbar={isMinimalTopbar}
          crumbs={crumbs}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenGuide={() => setGuideOpen(true)}
          onLogout={onLogout}
        />

        <main id="main-content" className="flex-1 p-4 lg:p-6" tabIndex={-1}>
          <div className="mx-auto flex max-w-7xl flex-col gap-5">{children}</div>
        </main>

        <footer className="print-hidden sr-only" aria-live="polite">
          <p role="status">{status}</p>
        </footer>
      </div>
      <GuidedTour open={guideOpen} onOpenChange={setGuideOpen} />
    </div>
  );
}
