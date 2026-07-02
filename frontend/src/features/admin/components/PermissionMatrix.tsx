import { useId, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { PermissionCatalogGroup, RoleDefinition } from '@/lib/api';
import { cn } from '@/lib/utils';

type PermissionMatrixProps = {
  roles: RoleDefinition[];
  permissionCatalog: PermissionCatalogGroup[];
  className?: string;
};

export function PermissionMatrix({ roles, permissionCatalog, className }: PermissionMatrixProps) {
  const titleId = useId();
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
        'rounded-md border border-operational-border bg-operational-surface p-4 shadow-sm',
        className,
      )}
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id={titleId} className="text-sm font-semibold text-foreground">
          Matriz de permisos
        </h2>
        <p className="text-xs text-muted-foreground">
          {permissionCatalog.reduce((acc, group) => acc + group.permissions.length, 0)} permisos / {roles.length} roles
        </p>
      </header>

      <div className="overflow-x-auto">
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
                  {formatRoleName(role.name)}
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
              <span className="font-mono text-[10px] text-muted-foreground">{permission.name}</span>
            </div>
          </th>
          {roles.map((role) => {
            const granted = roleHasPermission(role, permission.name);

            return (
              <td
                key={`${permission.name}-${role.id}`}
                className="p-2 text-center align-middle"
                aria-label={`${role.name} ${granted ? 'tiene' : 'no tiene'} ${permission.label}`}
              >
                <span
                  className={cn(
                    'inline-flex min-w-10 items-center justify-center rounded-full px-2 py-1 text-xs font-semibold',
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

function formatRoleName(name: string): string {
  return name
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
