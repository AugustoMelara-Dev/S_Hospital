import {
  Archive,
  Banknote,
  BookOpenText,
  ChartColumn,
  CircleHelp,
  LayoutDashboard,
  ReceiptText,
  ScrollText,
  Settings2,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { Permission } from '@/api/types';

export type NavItem = {
  to: string;
  /** Full name (tooltips, command palette, page titles). */
  label: string;
  /** Short label under the sidebar icon. */
  short: string;
  icon: LucideIcon;
  /** Any of these permissions (undefined = any authenticated user). */
  perms?: Permission[];
  group: 'main' | 'admin' | 'help';
  keywords?: string;
};

/**
 * The catalog administration page is for roles that manage or audit the catalog.
 * Cashiers have `catalog.view` only to search services while charging (Cobrar),
 * so the Administración section stays hidden for them.
 */
export const CATALOG_PAGE_PERMS: Permission[] = ['catalog.manage', 'audit.view'];

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Resumen', short: 'Resumen', icon: LayoutDashboard, group: 'main', keywords: 'inicio hoy kpi' },
  { to: '/cobrar', label: 'Cobrar', short: 'Cobrar', icon: Banknote, perms: ['invoices.create'], group: 'main', keywords: 'factura venta operación' },
  { to: '/recibos', label: 'Recibos', short: 'Recibos', icon: ReceiptText, perms: ['invoices.view'], group: 'main', keywords: 'facturas documentos reimprimir anular' },
  { to: '/caja', label: 'Caja', short: 'Caja', icon: Wallet, perms: ['cash.view'], group: 'main', keywords: 'apertura cierre arqueo turno' },
  { to: '/reportes', label: 'Reportes', short: 'Reportes', icon: ChartColumn, perms: ['reports.own', 'reports.all'], group: 'main', keywords: 'informe excel pdf' },
  { to: '/admin/catalogo', label: 'Catálogo y precios', short: 'Catálogo', icon: BookOpenText, perms: CATALOG_PAGE_PERMS, group: 'admin', keywords: 'servicios productos precios impuestos' },
  { to: '/admin/usuarios', label: 'Usuarios y permisos', short: 'Usuarios', icon: Users, perms: ['users.view'], group: 'admin', keywords: 'roles clave' },
  { to: '/admin/ajustes', label: 'Ajustes institucionales', short: 'Ajustes', icon: Settings2, perms: ['settings.view', 'receipt_settings.view'], group: 'admin', keywords: 'hospital cai numeración fiscal impresión' },
  { to: '/admin/respaldos', label: 'Respaldos', short: 'Respaldos', icon: Archive, perms: ['backups.view', 'system.status'], group: 'admin', keywords: 'backup copia sistema' },
  { to: '/admin/auditoria', label: 'Auditoría', short: 'Auditoría', icon: ScrollText, perms: ['audit.view'], group: 'admin', keywords: 'bitácora registro' },
  { to: '/ayuda', label: 'Ayuda', short: 'Ayuda', icon: CircleHelp, group: 'help', keywords: 'atajos manual' },
];
