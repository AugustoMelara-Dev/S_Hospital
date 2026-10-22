import { lazy, Suspense } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { PermissionGate } from './components/PermissionGate';
import { AdminEmpty } from './design-system/admin/components';
import { type AuthUser, type CashSession } from './lib/api';
import {
  canAccessAdminItem,
  adminPrimarySections,
  adminRoutePaths,
  resolveAdminLanding,
  type AdminNavigationItem,
} from './navigation/adminNavigation';
import type { OperationalStatusReporter } from './app/operationalStatus';

const ResumenView = lazy(() =>
  import('./features/resumen/ResumenView').then((module) => ({ default: module.ResumenView })),
);
const CobrarView = lazy(() =>
  import('./features/cobrar/CobrarView').then((module) => ({ default: module.CobrarView })),
);
const RecibosView = lazy(() =>
  import('./features/recibos/RecibosView').then((module) => ({ default: module.RecibosView })),
);
const CajaView = lazy(() =>
  import('./features/caja/CajaView').then((module) => ({ default: module.CajaView })),
);
const ReportesView = lazy(() =>
  import('./features/reportes/ReportesView').then((module) => ({ default: module.ReportesView })),
);
const AdministracionView = lazy(() =>
  import('./features/administracion/AdministracionView').then((module) => ({
    default: module.AdministracionView,
  })),
);

type AppRoutesProps = {
  canCreateInvoices: boolean;
  canCreatePayments: boolean;
  canEditFiscalSettings: boolean;
  canEditOperationalSettings: boolean;
  canManageCatalog: boolean;
  canOpenCash: boolean;
  canCloseAnyCash: boolean;
  canCloseCash: boolean;
  canViewBackups: boolean;
  canViewCash: boolean;
  canViewCatalog: boolean;
  canViewReceipts: boolean;
  canViewFiscalSettings: boolean;
  canViewReceiptSettings: boolean;
  canEditReceiptSettings: boolean;
  canEditAdvancedReceiptSettings: boolean;
  canViewInvoices: boolean;
  canViewReports: boolean;
  canViewManagerialReports: boolean;
  canViewCashSessionReports: boolean;
  canViewAuditReports: boolean;
  canExportReports: boolean;
  canViewUsers: boolean;
  canCreateUsers: boolean;
  canUpdateUsers: boolean;
  canDisableUsers: boolean;
  canManageRoles: boolean;
  canMarkDialysisPrescription: boolean;
  cashSession: CashSession | null;
  onStatus: OperationalStatusReporter;
  user: AuthUser;
};

function AdminRouteLoading({ label }: { label: string }) {
  return (
    <p
      role="status"
      className="px-1 py-6 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]"
    >
      {label}
    </p>
  );
}

function sectionById(id: string): AdminNavigationItem {
  const section = adminPrimarySections.find((item) => item.id === id);

  if (!section) {
    throw new Error(`Sección admin desconocida: ${id}`);
  }

  return section;
}

export function AppRoutes(props: AppRoutesProps) {
  const { user } = props;
  const landing = resolveAdminLanding(user);
  const cobrar = sectionById('cobrar');
  const recibos = sectionById('recibos');
  const caja = sectionById('caja');
  const reportes = sectionById('reportes');

  return (
    <Routes>
      <Route path="/" element={<Navigate to={landing} replace />} />
      <Route path="/login" element={<Navigate to={landing} replace />} />

      <Route
        path={adminRoutePaths.resumen}
        element={
          <Suspense fallback={<AdminRouteLoading label="Cargando resumen…" />}>
            <ResumenView />
          </Suspense>
        }
      />

      <Route
        path={adminRoutePaths.cobrar}
        element={
          <PermissionGate
            allowed={canAccessAdminItem(cobrar, user.permissions)}
            reason={cobrar.deniedReason}
          >
            <Suspense fallback={<AdminRouteLoading label="Cargando cobro…" />}>
              <CobrarView />
            </Suspense>
          </PermissionGate>
        }
      />

      <Route
        path={adminRoutePaths.recibos}
        element={
          <PermissionGate
            allowed={canAccessAdminItem(recibos, user.permissions)}
            reason={recibos.deniedReason}
          >
            <Suspense fallback={<AdminRouteLoading label="Cargando recibos…" />}>
              <RecibosView />
            </Suspense>
          </PermissionGate>
        }
      />

      <Route
        path={adminRoutePaths.caja}
        element={
          <PermissionGate
            allowed={canAccessAdminItem(caja, user.permissions)}
            reason={caja.deniedReason}
          >
            <Suspense fallback={<AdminRouteLoading label="Cargando caja…" />}>
              <CajaView />
            </Suspense>
          </PermissionGate>
        }
      />

      <Route
        path={`${adminRoutePaths.reportes}/*`}
        element={
          <PermissionGate
            allowed={canAccessAdminItem(reportes, user.permissions)}
            reason={reportes.deniedReason}
          >
            <Suspense fallback={<AdminRouteLoading label="Cargando reportes…" />}>
              <ReportesView />
            </Suspense>
          </PermissionGate>
        }
      />

      <Route
        path={`${adminRoutePaths.administracion}/*`}
        element={
          <Suspense fallback={<AdminRouteLoading label="Cargando administración…" />}>
            <AdministracionView />
          </Suspense>
        }
      />

      {/* Rutas de propuestas redirigen al destino operativo canónico */}
      <Route path="/propuestas/*" element={<Navigate to={adminRoutePaths.cobrar} replace />} />
      <Route path="/cobrar-a" element={<Navigate to={adminRoutePaths.cobrar} replace />} />
      <Route path="/cobrar-b" element={<Navigate to={adminRoutePaths.cobrar} replace />} />

      {/* Rutas antiguas → destino nuevo (redirección autorizada, sin segundo shell). */}
      <Route path="/dashboard" element={<Navigate to={adminRoutePaths.resumen} replace />} />
      <Route path="/billing/new" element={<Navigate to={adminRoutePaths.cobrar} replace />} />
      <Route path="/invoices" element={<Navigate to={adminRoutePaths.recibos} replace />} />
      <Route path="/cashbox" element={<Navigate to={adminRoutePaths.caja} replace />} />
      <Route path="/reports/*" element={<Navigate to={adminRoutePaths.reportes} replace />} />
      <Route path="/catalog" element={<Navigate to={adminRoutePaths.administracionCatalogo} replace />} />
      <Route path="/admin/users" element={<Navigate to={adminRoutePaths.administracionUsuarios} replace />} />
      <Route path="/settings/*" element={<Navigate to={adminRoutePaths.administracionAjustes} replace />} />
      <Route
        path="/backups"
        element={<Navigate to={`${adminRoutePaths.administracionMantenimiento}/respaldos`} replace />}
      />
      <Route path="/help" element={<Navigate to={adminRoutePaths.administracionAyuda} replace />} />
      <Route path="/support" element={<Navigate to={adminRoutePaths.administracionAyuda} replace />} />
      <Route path="/about" element={<Navigate to={adminRoutePaths.administracionAyuda} replace />} />

      <Route path="*" element={<AdminNotFound landing={landing} />} />
    </Routes>
  );
}

export function AdminNotFound({ landing = adminRoutePaths.resumen }: { landing?: string }) {
  return (
    <section className="mx-auto max-w-2xl py-8">
      {/* H1 real de la página: el título del estado vacío ES el encabezado
          (axe `page-has-heading-one`); no se duplica el texto en otro nodo. */}
      <AdminEmpty
        headingLevel={1}
        title="Ruta no encontrada"
        description="La pantalla solicitada no existe dentro de la navegación principal."
        action={
          <Link
            to={landing}
            className="inline-flex h-[var(--ui-control-h)] items-center rounded-[var(--ui-radius-control)] bg-[var(--ui-action)] px-3 text-[length:var(--ui-text-base)] font-semibold text-[color:var(--ui-action-foreground)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)] hover:bg-[var(--ui-action-hover)]"
          >
            Ir al inicio
          </Link>
        }
      />
    </section>
  );
}

/** Alias de compatibilidad para consumidores previos del shell R2. */
export const NotFoundView = AdminNotFound;
