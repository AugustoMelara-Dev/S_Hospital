import {
  ChartColumnIcon,
  ClipboardListIcon,
  CircleHelpIcon,
  DatabaseBackupIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  ShoppingCartIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from 'lucide-react';

/**
 * Iconos de navegación del panel administrativo. Una sola familia (lucide) con
 * `currentColor`; el color del estado lo aporta el contenedor. Se comparten
 * entre la barra lateral y la paleta de comandos para no duplicar el mapa.
 */
export const SECTION_ICONS: Record<string, LucideIcon> = {
  resumen: LayoutDashboardIcon,
  cobrar: ShoppingCartIcon,
  recibos: FileTextIcon,
  caja: WalletIcon,
  reportes: ChartColumnIcon,
  administracion: SettingsIcon,
};

export const ADMIN_ICONS: Record<string, LucideIcon> = {
  catalogo: ClipboardListIcon,
  usuarios: UsersIcon,
  ajustes: SettingsIcon,
  mantenimiento: DatabaseBackupIcon,
  ayuda: CircleHelpIcon,
};
