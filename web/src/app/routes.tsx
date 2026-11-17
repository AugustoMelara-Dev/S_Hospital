import { lazy, Suspense, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react';
import { Outlet, type RouteObject } from 'react-router';
import type { Permission } from '@/api/types';
import { AuthProvider } from '@/auth/AuthProvider';
import { FullScreenLoader, RequireAuth, RequirePermission } from '@/auth/guards';
import { AppShell } from '@/shell/AppShell';
import { CATALOG_PAGE_PERMS } from './nav';

const LoginPage = lazy(() => import('@/pages/LoginPage'));
const ChangePasswordPage = lazy(() => import('@/pages/ChangePasswordPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

const ResumenPage = lazy(() => import('@/features/resumen/ResumenPage'));
const CobrarPage = lazy(() => import('@/features/cobrar/CobrarPage'));
const RecibosPage = lazy(() => import('@/features/recibos/RecibosPage'));
const ReciboDetallePage = lazy(() => import('@/features/recibos/ReciboDetallePage'));
const CajaPage = lazy(() => import('@/features/caja/CajaPage'));
const ReportesPage = lazy(() => import('@/features/reportes/ReportesPage'));
const CatalogoPage = lazy(() => import('@/features/catalogo/CatalogoPage'));
const UsuariosPage = lazy(() => import('@/features/usuarios/UsuariosPage'));
const AjustesPage = lazy(() => import('@/features/ajustes/AjustesPage'));
const RespaldosPage = lazy(() => import('@/features/respaldos/RespaldosPage'));
const AuditoriaPage = lazy(() => import('@/features/auditoria/AuditoriaPage'));
const AyudaPage = lazy(() => import('@/features/ayuda/AyudaPage'));

function guarded(Page: LazyExoticComponent<ComponentType>, perm?: Permission[]): ReactNode {
  return (
    <RequirePermission perm={perm}>
      <Page />
    </RequirePermission>
  );
}

function Root() {
  return (
    <AuthProvider>
      <Suspense fallback={<FullScreenLoader />}>
        <Outlet />
      </Suspense>
    </AuthProvider>
  );
}

/** Route table (SPEC §7). Guards use "any of" semantics. */
export const routes: RouteObject[] = [
  {
    element: <Root />,
    children: [
      { path: '/login', element: <LoginPage /> },
      {
        path: '/cambiar-clave',
        element: (
          <RequireAuth allowPasswordChange>
            <ChangePasswordPage />
          </RequireAuth>
        ),
      },
      {
        element: (
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        ),
        children: [
          { index: true, element: guarded(ResumenPage) },
          { path: 'cobrar', element: guarded(CobrarPage, ['invoices.create']) },
          { path: 'recibos', element: guarded(RecibosPage, ['invoices.view']) },
          { path: 'recibos/:id', element: guarded(ReciboDetallePage, ['invoices.view']) },
          { path: 'caja', element: guarded(CajaPage, ['cash.view']) },
          { path: 'reportes', element: guarded(ReportesPage, ['reports.own', 'reports.all']) },
          { path: 'admin/catalogo', element: guarded(CatalogoPage, CATALOG_PAGE_PERMS) },
          { path: 'admin/usuarios', element: guarded(UsuariosPage, ['users.view']) },
          { path: 'admin/ajustes', element: guarded(AjustesPage, ['settings.view', 'receipt_settings.view']) },
          { path: 'admin/respaldos', element: guarded(RespaldosPage, ['backups.view', 'system.status']) },
          { path: 'admin/auditoria', element: guarded(AuditoriaPage, ['audit.view']) },
          { path: 'ayuda', element: guarded(AyudaPage) },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
