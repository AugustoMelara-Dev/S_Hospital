import { useId, useState } from 'react';
import { DownOutlined as ChevronDown, RightOutlined as ChevronRight } from '@ant-design/icons';
import { Button, Table, Tag, type TableColumnsType } from 'antd';
import type { PermissionCatalogGroup, RoleDefinition } from '@/lib/api';
import { roleLabel } from '@/lib/role-labels';
import { cn } from '@/lib/utils';
import { isCriticalPermission, permissionRiskLabel } from './permission-risk';

type PermissionMatrixProps = {
  roles: RoleDefinition[];
  permissionCatalog: PermissionCatalogGroup[];
  className?: string;
};

type CatalogPermission = PermissionCatalogGroup['permissions'][number];

type PermissionMatrixRow = {
  children?: PermissionMatrixRow[];
  key: string;
  kind: 'group' | 'permission';
  label: string;
  module: string;
  permission?: CatalogPermission;
};

export function PermissionMatrix({ roles, permissionCatalog, className }: PermissionMatrixProps) {
  const titleId = useId();
  const matrixId = useId();
  const [isMatrixOpen, setIsMatrixOpen] = useState(false);
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>(
    () => permissionCatalog.map((group) => `group-${group.module}`),
  );

  if (roles.length === 0 || permissionCatalog.length === 0) {
    return null;
  }

  const rows: PermissionMatrixRow[] = permissionCatalog.map((group) => ({
    key: `group-${group.module}`,
    kind: 'group',
    label: group.label,
    module: group.module,
    children: group.permissions.map((permission) => ({
      key: `permission-${permission.name}`,
      kind: 'permission',
      label: permission.label,
      module: group.module,
      permission,
    })),
  }));

  const columns: TableColumnsType<PermissionMatrixRow> = [
    {
      title: 'Permiso',
      dataIndex: 'label',
      key: 'permission',
      rowScope: 'row',
      render: (_value, row) => row.kind === 'group' ? (
        <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
          {row.label}
          <span className="ml-2 normal-case tracking-normal text-muted-foreground">
            ({row.children?.length ?? 0} {(row.children?.length ?? 0) === 1 ? 'permiso' : 'permisos'})
          </span>
        </span>
      ) : row.permission ? (
        <span className="flex flex-col">
          <span className="font-medium">{row.permission.label}</span>
          {isCriticalPermission(row.permission) ? (
            <Tag color="warning" className="mt-1 w-fit text-xs font-semibold uppercase">
              Permiso critico
            </Tag>
          ) : null}
          {isCriticalPermission(row.permission) && permissionRiskLabel(row.permission) ? (
            <span className="mt-1 max-w-56 text-xs leading-snug text-warning-foreground">
              {permissionRiskLabel(row.permission)}
            </span>
          ) : null}
        </span>
      ) : null,
    },
    ...roles.map((role) => ({
      title: roleLabel(role.name),
      key: `role-${role.id}`,
      align: 'center' as const,
      width: 128,
      render: (_value: unknown, row: PermissionMatrixRow) => {
        if (row.kind !== 'permission' || !row.permission) return null;
        const granted = role.permissions.some((permission) => permission.name === row.permission?.name);
        const label = `${roleLabel(role.name)} ${granted ? 'tiene' : 'no tiene'} ${row.permission.label}`;

        return (
          <span
            aria-label={label}
            className={cn(
              'inline-flex min-w-10 items-center justify-center px-2 py-1 text-xs font-semibold',
              granted ? 'bg-success/15 text-success-foreground' : 'bg-muted/40 text-muted-foreground',
            )}
          >
            {granted ? 'Si' : 'No'}
          </span>
        );
      },
    })),
  ];

  return (
    <section
      aria-labelledby={titleId}
      className={cn('border border-operational-border bg-operational-surface p-5 sm:p-6', className)}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={titleId} className="text-sm font-semibold text-foreground">
          Matriz de permisos
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {permissionCatalog.reduce((acc, group) => acc + group.permissions.length, 0)} permisos / {roles.length} roles
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
          <Table<PermissionMatrixRow>
            aria-labelledby={titleId}
            columns={columns}
            dataSource={rows}
            pagination={false}
            rowKey="key"
            size="small"
            scroll={{ x: 'max-content' }}
            expandable={{
              expandedRowKeys,
              indentSize: 12,
              onExpand: (expanded, row) => {
                setExpandedRowKeys((current) => expanded
                  ? [...current, row.key]
                  : current.filter((key) => key !== row.key));
              },
              rowExpandable: (row) => row.kind === 'group',
              expandIcon: ({ expanded, onExpand, record }) => record.kind === 'group' ? (
                <Button
                  aria-label={record.label}
                  htmlType="button"
                  type="text"
                  className="min-h-11 min-w-11"
                  icon={expanded ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
                  onClick={(event) => onExpand(record, event)}
                />
              ) : null,
            }}
          />
        </div>
      ) : null}
    </section>
  );
}
