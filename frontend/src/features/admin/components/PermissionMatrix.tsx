import { useId, useState } from 'react';
import { DownOutlined as ChevronDown, RightOutlined as ChevronRight } from '@ant-design/icons';
import { Button, Tag } from 'antd';
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

  if (roles.length === 0 || permissionCatalog.length === 0) return null;

  const gridStyle = {
    gridTemplateColumns: `minmax(14rem, 1fr) repeat(${roles.length}, minmax(8rem, 1fr))`,
  };

  return (
    <section
      aria-labelledby={titleId}
      className={cn('border border-operational-border bg-operational-surface p-5 sm:p-6', className)}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={titleId} className="text-sm font-semibold text-foreground">Matriz de permisos</h2>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {permissionCatalog.reduce((total, group) => total + group.permissions.length, 0)} permisos / {roles.length} roles
          </p>
          <Button
            aria-controls={matrixId}
            aria-expanded={isMatrixOpen}
            onClick={() => setIsMatrixOpen((current) => !current)}
            icon={isMatrixOpen ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
          >
            {isMatrixOpen ? 'Ocultar matriz de permisos' : 'Mostrar matriz de permisos'}
          </Button>
        </div>
      </header>

      {isMatrixOpen ? (
        <div id={matrixId} className="mt-3 overflow-x-auto">
          <div role="table" aria-labelledby={titleId} className="min-w-max border border-operational-border">
            <div role="row" className="grid border-b border-operational-border bg-muted" style={gridStyle}>
              <span role="columnheader" className="p-2 text-left text-xs font-semibold text-muted-foreground">Permiso</span>
              {roles.map((role) => (
                <span key={role.id} role="columnheader" className="p-2 text-center text-xs font-semibold text-muted-foreground">
                  {roleLabel(role.name)}
                </span>
              ))}
            </div>

            {permissionCatalog.map((group) => {
              const isExpanded = expandedGroups[group.module] ?? true;
              const groupId = `pm-group-${group.module}`;

              return (
                <div key={group.module} role="rowgroup">
                  <Button
                    type="text"
                    block
                    aria-controls={groupId}
                    aria-expanded={isExpanded}
                    aria-label={group.label}
                    className="min-h-11 justify-start border-b border-operational-border bg-operational-panel/40 px-2 text-left text-xs font-semibold uppercase tracking-wide"
                    icon={isExpanded ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
                    onClick={() => setExpandedGroups((current) => ({ ...current, [group.module]: !isExpanded }))}
                  >
                    {group.label}
                    <span className="ml-2 normal-case tracking-normal text-muted-foreground">
                      ({group.permissions.length} {group.permissions.length === 1 ? 'permiso' : 'permisos'})
                    </span>
                  </Button>

                  {isExpanded ? (
                    <div id={groupId}>
                      {group.permissions.map((permission) => (
                        <div
                          key={permission.name}
                          role="row"
                          className="grid border-b border-operational-border/60 last:border-b-0"
                          style={gridStyle}
                        >
                          <div role="rowheader" className="p-2 text-left text-xs text-foreground">
                            <span className="flex flex-col">
                              <span className="font-medium">{permission.label}</span>
                              {isCriticalPermission(permission) ? (
                                <Tag color="warning" className="mt-1 w-fit text-xs font-semibold uppercase">Permiso critico</Tag>
                              ) : null}
                              {isCriticalPermission(permission) && permissionRiskLabel(permission) ? (
                                <span className="mt-1 max-w-56 text-xs leading-snug text-warning-foreground">
                                  {permissionRiskLabel(permission)}
                                </span>
                              ) : null}
                            </span>
                          </div>
                          {roles.map((role) => {
                            const granted = role.permissions.some((item) => item.name === permission.name);
                            return (
                              <div
                                key={`${permission.name}-${role.id}`}
                                role="cell"
                                aria-label={`${roleLabel(role.name)} ${granted ? 'tiene' : 'no tiene'} ${permission.label}`}
                                className="flex items-center justify-center p-2"
                              >
                                <span className={cn(
                                  'inline-flex min-w-10 items-center justify-center px-2 py-1 text-xs font-semibold',
                                  granted ? 'bg-success/15 text-success-foreground' : 'bg-muted/40 text-muted-foreground',
                                )}>
                                  {granted ? 'Si' : 'No'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
