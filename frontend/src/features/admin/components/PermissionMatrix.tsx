import { useId, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  const [expandedModules, setExpandedModules] = useState<string[]>(() => permissionCatalog.map((group) => group.module));

  if (roles.length === 0 || permissionCatalog.length === 0) return null;

  const permissionCount = permissionCatalog.reduce((total, group) => total + group.permissions.length, 0);
  const toggleModule = (module: string) => {
    setExpandedModules((current) => current.includes(module)
      ? current.filter((entry) => entry !== module)
      : [...current, module]);
  };

  return (
    <Card className={className} role="region" aria-labelledby={titleId}>
      <CardHeader className="sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle id={titleId} role="heading" aria-level={2}>Matriz de permisos</CardTitle>
          <CardDescription>{permissionCount} permisos / {roles.length} roles</CardDescription>
        </div>
        <Button
          variant="outline"
          aria-controls={matrixId}
          aria-expanded={isMatrixOpen}
          onClick={() => setIsMatrixOpen((current) => !current)}
        >
          {isMatrixOpen ? <ChevronDown data-icon="inline-start" /> : <ChevronRight data-icon="inline-start" />}
          {isMatrixOpen ? 'Ocultar matriz de permisos' : 'Mostrar matriz de permisos'}
        </Button>
      </CardHeader>

      {isMatrixOpen ? (
        <CardContent id={matrixId} className="overflow-x-auto">
          <Table aria-labelledby={titleId} className="min-w-max">
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="min-w-72">Permiso</TableHead>
                {roles.map((role) => (
                  <TableHead scope="col" key={role.id} className="min-w-32 text-center">
                    {roleLabel(role.name)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissionCatalog.flatMap((group) => {
                const expanded = expandedModules.includes(group.module);
                const groupRow = (
                  <TableRow key={`group-${group.module}`} className="bg-muted/40 hover:bg-muted/40">
                    <TableCell colSpan={roles.length + 1}>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={group.label}
                        aria-expanded={expanded}
                        onClick={() => toggleModule(group.module)}
                      >
                        {expanded ? <ChevronDown data-icon="inline-start" /> : <ChevronRight data-icon="inline-start" />}
                        <span className="font-semibold uppercase tracking-wide">{group.label}</span>
                        <span className="text-muted-foreground">
                          ({group.permissions.length} {group.permissions.length === 1 ? 'permiso' : 'permisos'})
                        </span>
                      </Button>
                    </TableCell>
                  </TableRow>
                );

                if (!expanded) return [groupRow];

                return [
                  groupRow,
                  ...group.permissions.map((permission) => (
                    <TableRow key={permission.name}>
                      <th scope="row" className="px-2 py-2 text-left align-middle font-normal">
                        <span className="flex flex-col items-start gap-1">
                          <span className="font-medium">{permission.label}</span>
                          {isCriticalPermission(permission) ? <Badge variant="secondary">Permiso critico</Badge> : null}
                          {isCriticalPermission(permission) && permissionRiskLabel(permission) ? (
                            <span className="max-w-72 text-xs leading-snug text-muted-foreground">
                              {permissionRiskLabel(permission)}
                            </span>
                          ) : null}
                        </span>
                      </th>
                      {roles.map((role) => {
                        const granted = role.permissions.some((entry) => entry.name === permission.name);
                        return (
                          <TableCell key={role.id} className="text-center">
                            <span
                              aria-label={`${roleLabel(role.name)} ${granted ? 'tiene' : 'no tiene'} ${permission.label}`}
                              className={cn(
                                'inline-flex min-w-10 items-center justify-center rounded-md px-2 py-1 text-xs font-semibold',
                                granted ? 'bg-success/15 text-success-foreground' : 'bg-muted text-muted-foreground',
                              )}
                            >
                              {granted ? 'Si' : 'No'}
                            </span>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  )),
                ];
              })}
            </TableBody>
          </Table>
        </CardContent>
      ) : null}
    </Card>
  );
}
