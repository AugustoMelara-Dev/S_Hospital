import { type AuthUser } from '@/lib/api';

/**
 * Modelo de navegación "Panel administrativo" (no hereda la identidad R2).
 *
 * Alimenta la navegación lateral y la paleta de comandos. Las secciones
 * primarias son Resumen · Cobrar · Recibos · Caja · Reportes; Administración
 * agrupa sus destinos sin duplicarlos en el primer nivel.
 *
 * Permisos: se evalúan sobre `user.permissions`. La ruta sigue siendo la
 * autoridad final (AppRoutes vuelve a aplicar PermissionGate).
 */

export type AdminPermissionMode = 'all' | 'any';
export type AdminNavigationGroup = 'primary' | 'administration';

export type AdminNavigationItem = {
  id: string;
  label: string;
  path: string;
  group: AdminNavigationGroup;
  description: string;
  permissions?: string[];
  permissionMode?: AdminPermissionMode;
  /** Alternativas de paquetes completos: basta cumplir uno de los grupos. */
  permissionAlternatives?: string[][];
  /** Prefijos adicionales que dejan activa la sección (subrutas vivas). */
  activePathPrefixes?: string[];
  /** Razón mostrada por PermissionGate cuando falta permiso. */
  deniedReason?: string;
};

export const adminRoutePaths = {
  resumen: '/resumen',
  cobrar: '/cobrar',
  recibos: '/recibos',
  caja: '/caja',
  reportes: '/reportes',
  administracion: '/administracion',
  administracionCatalogo: '/administracion/catalogo',
  administracionUsuarios: '/administracion/usuarios',
  administracionAjustes: '/administracion/ajustes',
  administracionMantenimiento: '/administracion/mantenimiento',
  administracionAyuda: '/administracion/ayuda',
} as const;

export const adminPrimarySections: AdminNavigationItem[] = [
  {
    id: 'resumen',
    label: 'Resumen',
    path: adminRoutePaths.resumen,
    group: 'primary',
    description: 'Actividad del ámbito autorizado y caja actual.',
  },
  {
    id: 'cobrar',
    label: 'Cobrar',
    path: adminRoutePaths.cobrar,
    group: 'primary',
    description: 'Paciente, cuenta, regla aplicable y cobro.',
    permissions: ['invoices.create', 'catalog.view', 'cash.view', 'payments.create', 'receipts.view'],
    permissionMode: 'all',
    deniedReason:
      'Requiere permisos de facturación, catálogo, caja, pagos y recibos. Solicite el rol Cajero completo.',
  },
  {
    id: 'recibos',
    label: 'Recibos',
    path: adminRoutePaths.recibos,
    group: 'primary',
    description: 'Historial, detalle, reimpresión y recuperación del comprobante.',
    permissions: ['invoices.view'],
    deniedReason: 'Requiere permiso para consultar el historial de operaciones y recibos.',
  },
  {
    id: 'caja',
    label: 'Caja',
    path: adminRoutePaths.caja,
    group: 'primary',
    description: 'Apertura, movimientos, conciliación y cierre.',
    permissions: ['cash.view'],
    deniedReason: 'Requiere permiso para consultar y operar caja.',
  },
  {
    id: 'reportes',
    label: 'Reportes',
    path: adminRoutePaths.reportes,
    group: 'primary',
    description: 'Períodos, filtros, cobros y exportaciones.',
    permissions: ['reports.managerial.view', 'reports.cash_session.view', 'audit.view'],
    permissionMode: 'any',
    activePathPrefixes: ['/reportes'],
    deniedReason: 'Requiere permiso para consultar reportes operativos, gerenciales o de caja.',
  },
];

export const adminAdministrationItems: AdminNavigationItem[] = [
  {
    id: 'catalogo',
    label: 'Catálogo y precios',
    path: adminRoutePaths.administracionCatalogo,
    group: 'administration',
    description: 'Productos, servicios, categorías y precios.',
    permissions: ['catalog.view', 'catalog.manage'],
    permissionMode: 'any',
  },
  {
    id: 'usuarios',
    label: 'Usuarios y permisos',
    path: adminRoutePaths.administracionUsuarios,
    group: 'administration',
    description: 'Cuentas, roles y permisos.',
    permissions: ['users.view'],
  },
  {
    id: 'ajustes',
    label: 'Ajustes institucionales',
    path: adminRoutePaths.administracionAjustes,
    group: 'administration',
    description: 'Identidad y numeración; impresión sólo para soporte.',
    permissionAlternatives: [
      ['settings.fiscal.view'],
      ['settings.operational.update'],
      ['receipt_settings.view', 'receipt_settings.advanced'],
    ],
    activePathPrefixes: [adminRoutePaths.administracionAjustes],
  },
  {
    id: 'mantenimiento',
    label: 'Mantenimiento y respaldos',
    path: adminRoutePaths.administracionMantenimiento,
    group: 'administration',
    description: 'Copias, integridad y estado técnico.',
    permissions: ['backups.view', 'system.status.view'],
    permissionMode: 'any',
  },
  {
    id: 'ayuda',
    label: 'Ayuda',
    path: adminRoutePaths.administracionAyuda,
    group: 'administration',
    description: 'Guía breve de uso.',
  },
];

export function hasAdminPermissions(
  grantedPermissions: readonly string[],
  requiredPermissions: readonly string[] | undefined,
  mode: AdminPermissionMode = 'any',
): boolean {
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true;
  }

  if (mode === 'all') {
    return requiredPermissions.every((permission) => grantedPermissions.includes(permission));
  }

  return requiredPermissions.some((permission) => grantedPermissions.includes(permission));
}

export function canAccessAdminItem(
  item: AdminNavigationItem,
  grantedPermissions: readonly string[],
): boolean {
  if (item.permissionAlternatives) {
    return item.permissionAlternatives.some((alternative) => (
      alternative.every((permission) => grantedPermissions.includes(permission))
    ));
  }

  return hasAdminPermissions(
    grantedPermissions,
    item.permissions,
    item.permissionMode ?? 'any',
  );
}

export function getVisibleAdminSections(grantedPermissions: readonly string[]): AdminNavigationItem[] {
  return adminPrimarySections.filter((item) => canAccessAdminItem(item, grantedPermissions));
}

export function getVisibleAdministrationItems(
  grantedPermissions: readonly string[],
): AdminNavigationItem[] {
  return adminAdministrationItems.filter((item) => canAccessAdminItem(item, grantedPermissions));
}

function matchesPath(item: AdminNavigationItem, pathname: string): boolean {
  return (
    pathname === item.path ||
    pathname.startsWith(`${item.path}/`) ||
    (item.activePathPrefixes?.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    ) ?? false)
  );
}

/**
 * Sección activa resuelta por la ruta más específica, limitada a las secciones
 * visibles para el usuario. Devuelve `undefined` fuera de la navegación
 * principal (p. ej. Administración, que no compite con las primarias).
 */
export function getActiveAdminSection(
  pathname: string,
  grantedPermissions: readonly string[],
): AdminNavigationItem | undefined {
  return [...getVisibleAdminSections(grantedPermissions)]
    .sort((left, right) => right.path.length - left.path.length)
    .find((item) => matchesPath(item, pathname));
}

export function isAdministrationPath(pathname: string): boolean {
  return pathname === adminRoutePaths.administracion || pathname.startsWith(`${adminRoutePaths.administracion}/`);
}

/**
 * Landing por rol: el cajero aterriza en Cobrar; supervisión/administración en
 * Resumen. Si Cobrar no está autorizado, cae a Resumen y, en último caso, a la
 * primera sección visible.
 */
export function resolveAdminLanding(
  user: Pick<AuthUser, 'roles' | 'permissions'>,
): string {
  const cobrar = adminPrimarySections.find((item) => item.id === 'cobrar');
  const resumen = adminPrimarySections.find((item) => item.id === 'resumen');

  if (user.roles.includes('cajero') && cobrar && canAccessAdminItem(cobrar, user.permissions)) {
    return cobrar.path;
  }

  if (resumen && canAccessAdminItem(resumen, user.permissions)) {
    return resumen.path;
  }

  return getVisibleAdminSections(user.permissions)[0]?.path ?? adminRoutePaths.resumen;
}
