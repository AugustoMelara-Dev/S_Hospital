import { type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {
  BookOpenIcon,
  DatabaseBackupIcon,
  LifeBuoyIcon,
  Settings2Icon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';
import { PermissionGate } from '@/components/PermissionGate';
import { AdminEmpty } from '@/design-system/admin/components';
import { useAdminSession } from '@/shell/admin/AdminSessionContext';
import {
  getVisibleAdministrationItems,
  adminRoutePaths,
  type AdminNavigationItem,
} from '@/navigation/adminNavigation';
import { cn } from '@/lib/utils';
import { CatalogView } from '@/features/catalog/CatalogView';
import { UsersView } from '@/features/admin/UsersView';
import { AjustesView } from './AjustesView';
import { MantenimientoView } from './MantenimientoView';
import { AyudaView } from './AyudaView';

const focusRing =
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]';

const DENIED_REASONS: Record<string, string> = {
  catalogo: 'Su usuario no puede consultar el catálogo institucional.',
  usuarios: 'Su usuario no puede administrar cuentas, roles ni permisos.',
  ajustes:
    'Su usuario no puede consultar ni modificar los ajustes institucionales.',
  mantenimiento: 'Su usuario no puede consultar respaldos ni el estado técnico del sistema.',
};

/** Icono por sección: refuerza el nombre sin convertir la navegación en otro riel. */
const SECTION_ICONS: Record<string, LucideIcon> = {
  catalogo: BookOpenIcon,
  usuarios: UsersIcon,
  ajustes: Settings2Icon,
  mantenimiento: DatabaseBackupIcon,
  ayuda: LifeBuoyIcon,
};

/**
 * Destino actual de la navegación: la coincidencia **más específica** por ruta.
 *
 * El grupo declara un único destino actual (`aria-current="page"`) aunque en el
 * futuro una sección anide a otra: se resuelve por prefijo más largo, nunca por
 * coincidencia simultánea de varios enlaces.
 */
export function activeAdministrationItemId(
  pathname: string,
  items: AdminNavigationItem[],
): string | null {
  const match = [...items]
    .filter((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))
    .sort((left, right) => right.path.length - left.path.length)[0];

  return match?.id ?? null;
}

/**
 * Riel de secciones del panel administrativo.
 *
 * En `lg+` es una columna vertical con etiqueta + propósito de cada sección; en
 * pantallas estrechas se convierte en una banda horizontal desplazable. El
 * nombre accesible de cada enlace es exactamente su etiqueta (`aria-label`),
 * aunque visualmente acompañe una descripción.
 */
function AdminSectionTabs({ items }: { items: AdminNavigationItem[] }) {
  const { pathname } = useLocation();
  const activeId = activeAdministrationItemId(pathname, items);

  return (
    <nav aria-label="Secciones de administración" className="min-w-0">
      <ul className="flex min-w-max gap-1 border-b border-[var(--ui-line)] px-1">
        {items.map((item) => {
          const Icon = SECTION_ICONS[item.id] ?? BookOpenIcon;
          const active = item.id === activeId;

          return (
            <li key={item.id} className="shrink-0">
              <Link
                to={item.path}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                data-active={active ? 'true' : undefined}
                className={cn(
                  'group -mb-px flex min-h-[var(--ui-control-h)] items-center gap-2 border-b-2 px-3 py-2 text-[length:var(--ui-text-sm)]',
                  'transition-[color,background-color,border-color] duration-[var(--ui-duration-state)] ease-[var(--ui-ease-out)]',
                  active
                    ? 'border-[var(--ui-action)] font-semibold text-[color:var(--ui-action)]'
                    : 'border-transparent text-[color:var(--ui-ink-soft)] hover:border-[var(--ui-line-strong)] hover:text-[color:var(--ui-ink)]',
                  focusRing,
                )}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={active ? 2 : 1.5} />
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Administración "Panel administrativo".
 *
 * Composición nueva: navegación horizontal común y un encabezado específico
 * dentro de cada sección. Las secciones sin
 * permiso no se dibujan y el acceso directo por URL queda tras `PermissionGate`
 * (el backend sigue siendo la autoridad).
 */
export function AdministracionView() {
  const { user, onStatus } = useAdminSession();
  const items = getVisibleAdministrationItems(user.permissions);
  const allowed = (id: string) => items.some((item) => item.id === id);

  const gate = (id: string, node: ReactNode) => (
    <PermissionGate allowed={allowed(id)} reason={DENIED_REASONS[id]}>
      {node}
    </PermissionGate>
  );

  return (
    <section aria-label="Administración" className="flex flex-col gap-5">
      {items.length === 0 ? (
        <AdminEmpty
          title="Sin acceso a Administración"
          description="Su rol no habilita ninguna sección de administración. Solicite a un supervisor que revise los permisos de su cuenta."
        />
      ) : (
        <div className="min-w-0">
          <div className="overflow-x-auto">
            <AdminSectionTabs items={items} />
          </div>
          <div className="min-w-0 pt-5">
            <Routes>
              <Route index element={<Navigate to={items[0].path} replace />} />

              <Route
                path="catalogo"
                element={gate('catalogo', <CatalogView user={user} onStatus={onStatus} />)}
              />

              <Route
                path="usuarios"
                element={gate(
                  'usuarios',
                  <UsersView
                    onStatus={onStatus}
                    currentUserId={user.id}
                    canCreateUsers={user.permissions.includes('users.create')}
                    canUpdateUsers={user.permissions.includes('users.update')}
                    canDisableUsers={user.permissions.includes('users.disable')}
                    canManageRoles={user.permissions.includes('users.assign_admin_role')}
                    canAssignAdminRole={user.permissions.includes('users.assign_admin_role')}
                  />,
                )}
              />

              <Route path="ajustes" element={gate('ajustes', <AjustesView />)} />

              <Route
                path="mantenimiento"
                element={<Navigate to={`${adminRoutePaths.administracionMantenimiento}/respaldos`} replace />}
              />
              <Route
                path="mantenimiento/respaldos"
                element={gate('mantenimiento', <MantenimientoView />)}
              />

              <Route path="ayuda" element={<AyudaView />} />

              <Route path="*" element={<Navigate to={items[0].path} replace />} />
            </Routes>
          </div>
        </div>
      )}
    </section>
  );
}
