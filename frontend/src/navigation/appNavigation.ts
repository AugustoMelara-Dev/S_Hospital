import {
  Archive,
  Boxes,
  ClipboardList,
  FileClock,
  HelpCircle,
  Info,
  LayoutDashboard,
  ReceiptText,
  Settings,
  User,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';

type PermissionMode = 'all' | 'any';
export type NavigationGroup = 'operations' | 'administration' | 'support';

export type AppNavigationItem = {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  navigationGroup?: NavigationGroup;
  navigationPermissions?: string[];
  navigationPermissionMode?: PermissionMode;
};

export type AppBreadcrumb = {
  label: string;
  path: string;
};

export type AppRouteDefinition = {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  breadcrumbs: AppBreadcrumb[];
  navigation: boolean;
  navigationGroup?: NavigationGroup;
  navigationPermissions?: string[];
  navigationPermissionMode?: PermissionMode;
  requiredPermissions?: string[];
  permissionMode?: PermissionMode;
  deniedReason?: string;
};

export const appRoutes = {
  dashboard: {
    id: 'dashboard',
    label: 'Inicio',
    path: '/dashboard',
    icon: LayoutDashboard,
    breadcrumbs: [{ label: 'Inicio', path: '/dashboard' }],
    navigationGroup: 'operations',
    navigation: true,
  },
  newInvoice: {
    id: 'newInvoice',
    label: 'Nueva factura',
    path: '/billing/new',
    icon: ReceiptText,
    breadcrumbs: [
      { label: 'Inicio', path: '/dashboard' },
      { label: 'Nueva factura', path: '/billing/new' },
    ],
    navigationGroup: 'operations',
    navigation: true,
    navigationPermissions: ['invoices.create', 'catalog.view', 'cash.view', 'payments.create', 'receipts.view'],
    navigationPermissionMode: 'all',
    requiredPermissions: ['invoices.create', 'catalog.view', 'cash.view', 'payments.create', 'receipts.view'],
    permissionMode: 'all',
    deniedReason: 'Requiere permisos de facturación, catálogo, caja, pagos y recibos. Solicite el rol Cajero completo.',
  },
  cashbox: {
    id: 'cashbox',
    label: 'Caja',
    path: '/cashbox',
    icon: WalletCards,
    breadcrumbs: [
      { label: 'Inicio', path: '/dashboard' },
      { label: 'Caja', path: '/cashbox' },
    ],
    navigationGroup: 'operations',
    navigation: true,
    navigationPermissions: ['cash.view'],
    requiredPermissions: ['cash.view'],
    deniedReason: 'Requiere permiso para consultar y operar caja.',
  },
  catalog: {
    id: 'catalog',
    label: 'Catálogo',
    path: '/catalog',
    icon: Boxes,
    breadcrumbs: [
      { label: 'Inicio', path: '/dashboard' },
      { label: 'Catálogo', path: '/catalog' },
    ],
    navigationGroup: 'operations',
    navigation: true,
    navigationPermissions: ['catalog.view'],
    requiredPermissions: ['catalog.view'],
    deniedReason: 'Requiere permiso para consultar el catálogo de servicios.',
  },
  invoices: {
    id: 'invoices',
    label: 'Historial',
    path: '/invoices',
    icon: FileClock,
    breadcrumbs: [
      { label: 'Inicio', path: '/dashboard' },
      { label: 'Historial', path: '/invoices' },
    ],
    navigationGroup: 'operations',
    navigation: true,
    navigationPermissions: ['invoices.view'],
    requiredPermissions: ['invoices.view'],
    deniedReason: 'Requiere permiso para consultar historial de facturas y recibos.',
  },
  reports: {
    id: 'reports',
    label: 'Reportes',
    path: '/reports',
    icon: ClipboardList,
    breadcrumbs: [
      { label: 'Inicio', path: '/dashboard' },
      { label: 'Reportes', path: '/reports' },
    ],
    navigationGroup: 'operations',
    navigation: true,
    navigationPermissions: ['reports.managerial.view', 'reports.cash_session.view', 'audit.view'],
    requiredPermissions: ['reports.managerial.view', 'reports.cash_session.view', 'audit.view'],
    permissionMode: 'any',
    deniedReason: 'Requiere permiso para consultar reportes operativos, gerenciales o de caja.',
  },
  backups: {
    id: 'backups',
    label: 'Respaldos',
    path: '/backups',
    icon: Archive,
    breadcrumbs: [
      { label: 'Inicio', path: '/dashboard' },
      { label: 'Respaldos', path: '/backups' },
    ],
    navigationGroup: 'administration',
    navigation: true,
    navigationPermissions: ['backups.view'],
    requiredPermissions: ['backups.view'],
    deniedReason: 'Requiere permiso para consultar respaldos locales.',
  },
  fiscalSettings: {
    id: 'fiscalSettings',
    label: 'Configuración',
    path: '/settings/fiscal',
    icon: Settings,
    breadcrumbs: [
      { label: 'Inicio', path: '/dashboard' },
      { label: 'Configuración', path: '/settings/fiscal' },
    ],
    navigationGroup: 'administration',
    navigation: true,
    navigationPermissions: ['settings.fiscal.view', 'settings.operational.update'],
    requiredPermissions: ['settings.fiscal.view', 'settings.operational.update'],
    permissionMode: 'any',
    deniedReason: 'Requiere permiso para consultar configuración fiscal o editar reglas operativas.',
  },
  receiptSettings: {
    id: 'receiptSettings',
    label: 'Recibos',
    path: '/settings/institutional-receipts',
    icon: ReceiptText,
    breadcrumbs: [
      { label: 'Inicio', path: '/dashboard' },
      { label: 'Recibos institucionales', path: '/settings/institutional-receipts' },
    ],
    navigationGroup: 'administration',
    navigation: true,
    navigationPermissions: ['receipt_settings.view'],
    requiredPermissions: ['receipt_settings.view'],
    deniedReason: 'Requiere permiso para consultar configuracion de recibos institucionales.',
  },
  users: {
    id: 'users',
    label: 'Usuarios',
    path: '/admin/users',
    icon: User,
    breadcrumbs: [
      { label: 'Inicio', path: '/dashboard' },
      { label: 'Usuarios', path: '/admin/users' },
    ],
    navigationGroup: 'administration',
    navigation: true,
    navigationPermissions: ['users.view'],
    requiredPermissions: ['users.view'],
    deniedReason: 'Requiere permiso para gestionar usuarios.',
  },
  help: {
    id: 'help',
    label: 'Ayuda',
    path: '/help',
    icon: HelpCircle,
    breadcrumbs: [
      { label: 'Inicio', path: '/dashboard' },
      { label: 'Ayuda', path: '/help' },
    ],
    navigationGroup: 'support',
    navigation: true,
  },
  support: {
    id: 'support',
    label: 'Soporte',
    path: '/support',
    icon: HelpCircle,
    breadcrumbs: [
      { label: 'Inicio', path: '/dashboard' },
      { label: 'Soporte', path: '/support' },
    ],
    navigation: false,
  },
  about: {
    id: 'about',
    label: 'Acerca de',
    path: '/about',
    icon: Info,
    breadcrumbs: [
      { label: 'Inicio', path: '/dashboard' },
      { label: 'Acerca de', path: '/about' },
    ],
    navigation: false,
  },
} satisfies Record<string, AppRouteDefinition>;

export type AppRouteId = keyof typeof appRoutes;

function toNavigationItem(route: AppRouteDefinition): AppNavigationItem {
  return {
    id: route.id,
    label: route.label,
    path: route.path,
    icon: route.icon,
    navigationGroup: route.navigationGroup,
    navigationPermissions: route.navigationPermissions,
    navigationPermissionMode: route.navigationPermissionMode,
  };
}

export const primaryNavigation: AppNavigationItem[] = [
  appRoutes.dashboard,
  appRoutes.newInvoice,
  appRoutes.cashbox,
  appRoutes.catalog,
  appRoutes.invoices,
  appRoutes.reports,
  appRoutes.backups,
  appRoutes.fiscalSettings,
  appRoutes.receiptSettings,
  appRoutes.users,
  appRoutes.help,
].map(toNavigationItem);

export function hasPermissions(
  grantedPermissions: readonly string[],
  requiredPermissions: readonly string[] | undefined,
  mode: PermissionMode = 'any',
) {
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true;
  }

  if (mode === 'all') {
    return requiredPermissions.every((permission) => grantedPermissions.includes(permission));
  }

  return requiredPermissions.some((permission) => grantedPermissions.includes(permission));
}

export function canViewNavigationItem(item: AppNavigationItem, grantedPermissions: readonly string[]) {
  return hasPermissions(grantedPermissions, item.navigationPermissions, item.navigationPermissionMode ?? 'any');
}

export function canAccessRoute(route: AppRouteDefinition, grantedPermissions: readonly string[]) {
  return hasPermissions(grantedPermissions, route.requiredPermissions, route.permissionMode ?? 'all');
}

export function canAccessPath(path: string, grantedPermissions: readonly string[]) {
  const route = Object.values(appRoutes).find((candidate) => candidate.path === path);
  return route ? canAccessRoute(route, grantedPermissions) : false;
}

export function getVisibleNavigation(grantedPermissions: readonly string[]) {
  return primaryNavigation.filter((item) => canViewNavigationItem(item, grantedPermissions));
}

export function getActiveNavigationItem(pathname: string) {
  return [...primaryNavigation]
    .sort((left, right) => right.path.length - left.path.length)
    .find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));
}

export function getBreadcrumbs(pathname: string) {
  const route = Object.values(appRoutes)
    .sort((left, right) => right.path.length - left.path.length)
    .find((candidate) => pathname === candidate.path || pathname.startsWith(`${candidate.path}/`));

  return route?.breadcrumbs ?? [
    { label: 'Inicio', path: '/dashboard' },
    { label: 'Sin registro', path: pathname },
  ];
}
