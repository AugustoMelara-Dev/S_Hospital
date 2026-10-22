import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { AdminPanel, AdminPanelHeader } from '@/design-system/admin/components';
import type { PermissionCatalogGroup, RoleDefinition } from '@/lib/api';
import { roleLabel } from '@/lib/role-labels';
import { cn } from '@/lib/utils';
import { SECONDARY_BUTTON } from '../adminUi';
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
  const [expandedModules, setExpandedModules] = useState<string[]>(() => permissionCatalog.map((group) => group.module));

  if (roles.length === 0 || permissionCatalog.length === 0) return null;

  const permissionCount = permissionCatalog.reduce((total, group) => total + group.permissions.length, 0);
  const toggleModule = (module: string) => {
    setExpandedModules((current) => current.includes(module)
      ? current.filter((entry) => entry !== module)
      : [...current, module]);
  };

  return (
    <AdminPanel className={cn('overflow-hidden', className)} role="region" aria-labelledby={titleId}>
      <AdminPanelHeader
        id={titleId}
        title="Matriz de permisos"
        description={`${permissionCount} permisos / ${roles.length} roles`}
        actions={(
          <button
            type="button"
            data-ui-press
            className={SECONDARY_BUTTON}
            aria-controls={matrixId}
            aria-expanded={isMatrixOpen}
            onClick={() => setIsMatrixOpen((current) => !current)}
          >
            {isMatrixOpen ? <ChevronDown aria-hidden="true" className="size-4" strokeWidth={1.5} /> : <ChevronRight aria-hidden="true" className="size-4" strokeWidth={1.5} />}
            {isMatrixOpen ? 'Ocultar matriz de permisos' : 'Mostrar matriz de permisos'}
          </button>
        )}
      />

      {isMatrixOpen ? (
        <div id={matrixId} className="overflow-x-auto">
          <table aria-labelledby={titleId} className="w-full min-w-max border-collapse text-[length:var(--ui-text-base)]">
            <thead className="bg-[var(--ui-surface-alt)]">
              <tr>
                <th scope="col" className="min-w-72 border-b border-[var(--ui-line)] px-3 py-2 text-left text-[length:var(--ui-text-xs)] font-semibold uppercase tracking-[0.06em] text-[color:var(--ui-ink-soft)]">Permiso</th>
                {roles.map((role) => (
                  <th key={role.id} scope="col" className="min-w-32 border-b border-[var(--ui-line)] px-3 py-2 text-center text-[length:var(--ui-text-xs)] font-semibold uppercase tracking-[0.06em] text-[color:var(--ui-ink-soft)]">
                    {roleLabel(role.name)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissionCatalog.flatMap((group) => {
                const expanded = expandedModules.includes(group.module);
                const groupRow = (
                  <tr key={`group-${group.module}`} className="border-b border-[var(--ui-line)] bg-[var(--ui-surface-alt)]">
                    <td colSpan={roles.length + 1} className="px-2 py-1.5">
                      <button
                        type="button"
                        aria-label={group.label}
                        aria-expanded={expanded}
                        onClick={() => toggleModule(group.module)}
                        className="flex items-center gap-2 rounded-[var(--ui-radius-control)] px-2 py-1 text-left text-[color:var(--ui-ink)] outline-none hover:bg-[var(--ui-surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]"
                      >
                        {expanded ? <ChevronDown aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.5} /> : <ChevronRight aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.5} />}
                        <span className="font-semibold uppercase tracking-wide">{group.label}</span>
                        <span className="text-[color:var(--ui-ink-soft)]">
                          ({group.permissions.length} {group.permissions.length === 1 ? 'permiso' : 'permisos'})
                        </span>
                      </button>
                    </td>
                  </tr>
                );

                if (!expanded) return [groupRow];

                return [
                  groupRow,
                  ...group.permissions.map((permission) => (
                    <tr key={permission.name} className="border-b border-[var(--ui-line)] last:border-b-0">
                      <th scope="row" className="px-3 py-1.5 text-left align-middle font-normal">
                        <span className="flex flex-col items-start gap-1">
                          <span className="font-medium">{permission.label}</span>
                          {isCriticalPermission(permission) ? <CriticalTag /> : null}
                          {isCriticalPermission(permission) && permissionRiskLabel(permission) ? (
                            <span className="max-w-72 text-[length:var(--ui-text-xs)] leading-snug text-[color:var(--ui-ink-soft)]">
                              {permissionRiskLabel(permission)}
                            </span>
                          ) : null}
                        </span>
                      </th>
                      {roles.map((role) => {
                        const granted = role.permissions.some((entry) => entry.name === permission.name);
                        return (
                          <td key={role.id} className="px-3 py-1.5 text-center align-middle">
                            <span
                              aria-label={`${roleLabel(role.name)} ${granted ? 'tiene' : 'no tiene'} ${permission.label}`}
                              className={cn(
                                'inline-flex min-w-10 items-center justify-center rounded-[var(--ui-radius)] border px-2 py-0.5 text-[length:var(--ui-text-xs)] font-semibold',
                                granted
                                  ? 'border-[var(--ui-success-border)] bg-[var(--ui-success-subtle)] text-[color:var(--ui-success)]'
                                  : 'border-[var(--ui-line-strong)] text-[color:var(--ui-ink-soft)]',
                              )}
                            >
                              {granted ? 'Si' : 'No'}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  )),
                ];
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </AdminPanel>
  );
}

function CriticalTag(): ReactNode {
  return (
    <span className="inline-flex items-center rounded-[var(--ui-radius)] border border-[var(--ui-warn-border)] bg-[var(--ui-warn-subtle)] px-1.5 py-0.5 text-[length:var(--ui-text-xs)] font-semibold text-[color:var(--ui-warn)]">
      Permiso critico
    </span>
  );
}
