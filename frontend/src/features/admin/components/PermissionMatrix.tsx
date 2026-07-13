import { useId, useState } from 'react';
import { DownOutlined as ChevronDown, RightOutlined as ChevronRight } from '@ant-design/icons';
import type { PermissionCatalogGroup, RoleDefinition } from '@/lib/api';
import { roleLabel } from '@/lib/role-labels';
import { cn } from '@/lib/utils';
import { isCriticalPermission, permissionRiskLabel } from './permission-risk';

type PermissionMatrixProps = {
  roles: RoleDefinition[];
  permissionCatalog: PermissionCatalogGroup[];
  className?: string;
};

export function PermissionMatrix({ roles, permissionCatalog, className }: PermissionMatrixProps) {
  const titleId = useId();
  const matrixId = useId();
  const [isMatrixOpen, setIsMatrixOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  if (roles.length === 0 || permissionCatalog.length === 0) {
    return null;
  }

  function roleHasPermission(role: RoleDefinition, permissionName: string): boolean {
    return role.permissions.some((permission) => permission.name === permissionName);
  }

  function toggleGroup(module: string) {
    setExpandedGroups((current) => ({ ...current, [module]: !current[module] }));
  }

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        'border border-operational-border bg-operational-surface p-5 sm:p-6',
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={titleId} className="text-sm font-semibold text-foreground">
          Matriz de permisos
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {permissionCatalog.reduce((acc, group) => acc + group.permissions.length, 0)} permisos / {roles.length} roles
          </p>
          <button
            type="button"
            aria-controls={matrixId}
            aria-expanded={isMatrixOpen}
            onClick={() => setIsMatrixOpen((current) => !current)}
            className="inline-flex min-h-10 items-center gap-2 border border-operational-border bg-white px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {isMatrixOpen ? (
              <ChevronDown aria-hidden="true" className="size-3.5" />
            ) : (
              <ChevronRight aria-hidden="true" className="size-3.5" />
            )}
            {isMatrixOpen ? 'Ocultar matriz de permisos' : 'Mostrar matriz de permisos'}
          </button>
        </div>
      </header>

      {isMatrixOpen && (
        <div id={matrixId} className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm" aria-labelledby={titleId}>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 bg-operational-surface p-2 text-left text-xs font-semibold text-muted-foreground">
                  Permiso
                </th>
                {roles.map((role) => (
                  <th
                    key={role.id}
                    scope="col"
                    className="min-w-32 p-2 text-left text-xs font-semibold text-muted-foreground"
                  >
                    {roleLabel(role.name)}
                  </th>
                ))}
              </tr>
            </thead>
            {permissionCatalog.map((group) => {
              const isExpanded = expandedGroups[group.module] ?? true;

              return (
                <PermissionGroup
                  key={group.module}
                  group={group}
                  roles={roles}
                  isExpanded={isExpanded}
                  onToggle={() => toggleGroup(group.module)}
                  roleHasPermission={roleHasPermission}
                />
              );
            })}
          </table>
        </div>
      )}
    </section>
  );
}

type PermissionGroupProps = {
  group: PermissionCatalogGroup;
  roles: RoleDefinition[];
  isExpanded: boolean;
  onToggle: () => void;
  roleHasPermission: (role: RoleDefinition, permissionName: string) => boolean;
};

function PermissionGroup({
  group,
  roles,
  isExpanded,
  onToggle,
  roleHasPermission,
}: PermissionGroupProps) {
  const bodyId = `pm-group-${group.module}`;

  return (
    <tbody id={bodyId}>
      <tr>
        <th
          scope="colgroup"
          colSpan={roles.length + 1}
          className="border-b border-operational-border bg-operational-panel/40 p-0 text-left"
        >
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isExpanded}
            aria-controls={bodyId}
            className="flex w-full items-center gap-2 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-foreground transition-colors hover:bg-operational-panel/60"
          >
            {isExpanded ? (
              <ChevronDown aria-hidden="true" className="size-3.5" />
            ) : (
              <ChevronRight aria-hidden="true" className="size-3.5" />
            )}
            <span>{group.label}</span>
            <span className="ml-2 text-muted-foreground normal-case tracking-normal">
              ({group.permissions.length} {group.permissions.length === 1 ? 'permiso' : 'permisos'})
            </span>
          </button>
        </th>
      </tr>

      {isExpanded && group.permissions.map((permission) => (
        <tr key={permission.name} className="border-b border-operational-border/60 last:border-b-0">
          <th
            scope="row"
            className="sticky left-0 z-10 bg-operational-surface p-2 text-left align-top text-xs font-normal text-foreground"
          >
            <div className="flex flex-col">
              <span className="font-medium">{permission.label}</span>
              {isCriticalPermission(permission) && (
                <span className="mt-1 w-fit border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-warning-foreground">
                  Permiso critico
                </span>
              )}
              {isCriticalPermission(permission) && permissionRiskLabel(permission) && (
                <span className="mt-1 max-w-56 text-[10px] leading-snug text-warning-foreground">
                  {permissionRiskLabel(permission)}
                </span>
              )}
            </div>
          </th>
          {roles.map((role) => {
            const granted = roleHasPermission(role, permission.name);

            return (
              <td
                key={`${permission.name}-${role.id}`}
                className="p-2 text-center align-middle"
                aria-label={`${roleLabel(role.name)} ${granted ? 'tiene' : 'no tiene'} ${permission.label}`}
              >
                <span
                  className={cn(
                    'inline-flex min-w-10 items-center justify-center px-2 py-1 text-xs font-semibold',
                    granted
                      ? 'bg-success/15 text-success-foreground'
                      : 'bg-muted/40 text-muted-foreground',
                  )}
                >
                  {granted ? 'Si' : 'No'}
                </span>
              </td>
            );
          })}
        </tr>
      ))}
    </tbody>
  );
}
