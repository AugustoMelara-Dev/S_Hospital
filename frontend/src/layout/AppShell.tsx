import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { type AuthUser, type CashSession } from '../lib/api';
import { MobileSidebar, SidebarContent, appNavigation } from './Sidebar';
import { Topbar } from './Topbar';

type AppShellProps = {
  cashSession: CashSession | null;
  children: React.ReactNode;
  onQuickCash: () => void;
  onQuickInvoice: () => void;
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
  onQuickCash,
  onQuickInvoice,
  onLogout,
  status,
  user,
  topbarVariant = 'default',
  logoUrl,
}: AppShellProps) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const getBreadcrumbs = () => {
    const paths = location.pathname.split('/').filter(Boolean);
    const crumbs = [{ label: 'Inicio', path: '/' }];
    
    let currentPath = '';
    for (const segment of paths) {
      currentPath += `/${segment}`;
      if (segment === 'billing') {
        crumbs.push({ label: 'Facturación', path: '/billing/new' });
      } else if (segment === 'new') {
        crumbs.push({ label: 'Nueva Factura', path: '/billing/new' });
      } else if (segment === 'invoices') {
        crumbs.push({ label: 'Historial', path: '/invoices' });
      } else if (segment === 'about') {
        crumbs.push({ label: 'Acerca de', path: '/about' });
      } else if (segment === 'services') {
        crumbs.push({ label: 'Catálogo', path: '/services' });
      } else if (segment === 'cashbox') {
        crumbs.push({ label: 'Caja', path: '/cashbox' });
      } else if (segment === 'reports') {
        crumbs.push({ label: 'Reportes', path: '/reports' });
      } else if (segment === 'settings') {
        crumbs.push({ label: 'Configuración', path: '/settings' });
      } else if (segment === 'admin') {
        crumbs.push({ label: 'Administración', path: '/admin/users' });
      } else if (segment === 'users') {
        crumbs.push({ label: 'Usuarios', path: '/admin/users' });
      } else {
        crumbs.push({ label: segment.charAt(0).toUpperCase() + segment.slice(1), path: currentPath });
      }
    }
    
    // Deduplicate consecutive identical crumbs (like Admin -> Admin or billing -> new)
    const uniqueCrumbs: typeof crumbs = [];
    const seenLabels = new Set<string>();
    for (const crumb of crumbs) {
      if (!seenLabels.has(crumb.label)) {
        uniqueCrumbs.push(crumb);
        seenLabels.add(crumb.label);
      }
    }
    return uniqueCrumbs;
  };

  const crumbs = getBreadcrumbs();

  const canCreateInvoices = user.permissions.includes('invoices.create');
  const canViewCash = user.permissions.includes('cash.view');
  const canUseQuickInvoice =
    canCreateInvoices &&
    user.permissions.includes('catalog.view') &&
    canViewCash &&
    user.permissions.includes('payments.create') &&
    user.permissions.includes('receipts.view');
  const showInvoiceAction = canUseQuickInvoice && location.pathname !== '/billing/new';
  const showCashAction =
    canViewCash &&
    (cashSession || user.permissions.includes('cash.open')) &&
    location.pathname !== '/cashbox' &&
    location.pathname !== '/cashbox/';

  const isMinimalTopbar = topbarVariant === 'minimal';

  return (
    <div className="app-shell min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-teal-600 focus:px-4 focus:py-2 focus:text-white focus:font-bold focus:shadow-lg"
      >
        Omitir al contenido principal
      </a>
      
      {/* Mobile drawer navigation */}
      <MobileSidebar
        open={mobileMenuOpen}
        onOpenChange={setMobileMenuOpen}
        user={user}
        cashSession={cashSession}
        visibleNavigation={visibleNavigation}
        activeItem={activeItem}
        onLogout={onLogout}
        logoUrl={logoUrl}
      />

      {/* Permanent sidebar for larger devices */}
      <aside className="print-hidden hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 z-20">
        <SidebarContent
          user={user}
          cashSession={cashSession}
          visibleNavigation={visibleNavigation}
          activeItem={activeItem}
          onLogout={onLogout}
          logoUrl={logoUrl}
        />
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-col lg:ml-64 min-h-screen">
        <Topbar
          user={user}
          cashSession={cashSession}
          status={status}
          isMinimalTopbar={isMinimalTopbar}
          crumbs={crumbs}
          showInvoiceAction={showInvoiceAction}
          showCashAction={showCashAction}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onQuickInvoice={onQuickInvoice}
          onQuickCash={onQuickCash}
          onLogout={onLogout}
        />

        <main id="main-content" className="flex-1 p-4 lg:p-6" tabIndex={-1}>
          <div className="mx-auto flex max-w-7xl flex-col gap-5">{children}</div>
        </main>

        <footer className="print-hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3">
          <p className="mx-auto max-w-7xl text-sm text-slate-500 dark:text-slate-400 transition-colors" role="status">
            {status}
          </p>
        </footer>
      </div>
    </div>
  );
}
