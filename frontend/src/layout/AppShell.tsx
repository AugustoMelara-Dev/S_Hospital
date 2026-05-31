import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { type AuthUser, type CashSession } from '../lib/api';
import { GuidedTour, shouldAutoOpenGuidedTour } from '../features/onboarding/GuidedTour';
import { MobileSidebar, SidebarContent, appNavigation } from './Sidebar';
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

  useEffect(() => {
    if (shouldAutoOpenGuidedTour()) {
      setGuideOpen(true);
    }
  }, []);

  const visibleNavigation = appNavigation.filter((item) => {
    if (!item.permission) {
      return true;
    }

    const permissions = Array.isArray(item.permission) ? item.permission : [item.permission];
    return permissions.some((permission) => user.permissions.includes(permission));
  });

  const activeItem = [...appNavigation]
    .sort((left, right) => right.path.length - left.path.length)
    .find((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`));

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

function getBreadcrumbs(pathname: string) {
  const paths = pathname.split('/').filter(Boolean);
  const crumbs = [{ label: 'Inicio', path: '/' }];
  let currentPath = '';

  for (const segment of paths) {
    currentPath += `/${segment}`;

    if (segment === 'dashboard') {
      continue;
    }

    if (segment === 'billing') {
      crumbs.push({ label: 'Facturacion', path: '/billing/new' });
    } else if (segment === 'new') {
      crumbs.push({ label: 'Nueva factura', path: '/billing/new' });
    } else if (segment === 'invoices') {
      crumbs.push({ label: 'Historial', path: '/invoices' });
    } else if (segment === 'about') {
      crumbs.push({ label: 'Acerca de', path: '/about' });
    } else if (segment === 'help') {
      crumbs.push({ label: 'Ayuda', path: '/help' });
    } else if (segment === 'services' || segment === 'catalog') {
      crumbs.push({ label: 'Catalogo', path: '/catalog' });
    } else if (segment === 'area-services') {
      crumbs.push({ label: 'Servicios pagados', path: '/area-services' });
    } else if (segment === 'cashbox') {
      crumbs.push({ label: 'Caja', path: '/cashbox' });
    } else if (segment === 'reports') {
      crumbs.push({ label: 'Reportes', path: '/reports' });
    } else if (segment === 'settings') {
      crumbs.push({ label: 'Configuracion', path: '/settings' });
    } else if (segment === 'admin') {
      crumbs.push({ label: 'Administracion', path: '/admin/users' });
    } else if (segment === 'users') {
      crumbs.push({ label: 'Usuarios', path: '/admin/users' });
    } else {
      crumbs.push({ label: segment.charAt(0).toUpperCase() + segment.slice(1), path: currentPath });
    }
  }

  const uniqueCrumbs: typeof crumbs = [];
  const seenLabels = new Set<string>();
  for (const crumb of crumbs) {
    if (!seenLabels.has(crumb.label)) {
      uniqueCrumbs.push(crumb);
      seenLabels.add(crumb.label);
    }
  }

  return uniqueCrumbs;
}
