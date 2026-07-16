import {
  DisconnectOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { type RefObject } from 'react';
import { Button, Tooltip, Tag } from 'antd';
import { useServerStatus } from '../../hooks/useServerStatus';
import { type AuthUser, type CashSession } from '../../lib/api';
import { roleListLabel } from '../../lib/role-labels';
import { type AppBreadcrumb } from '../../navigation/appNavigation';
import { UserMenu } from '../../layout/components/UserMenu';

type ContextBarProps = {
  cashSession: CashSession | null;
  commandButtonRef: RefObject<HTMLButtonElement | null>;
  crumbs: AppBreadcrumb[];
  hospitalName: string;
  onLogout: () => void;
  onOpenCommands: () => void;
  onOpenGuide: () => void;
  status: string;
  user: AuthUser;
};

export function ContextBar({ cashSession, commandButtonRef, crumbs, hospitalName, onLogout, onOpenCommands, onOpenGuide, status, user }: ContextBarProps) {
  const { isOnline } = useServerStatus();
  const currentTitle = crumbs.at(-1)?.label ?? 'Inicio';
  const cashLabel = cashSession?.status === 'open' ? `Caja #${cashSession.id}` : 'Caja cerrada';

  return (
    <header data-audit-panel="context-bar" className="print-hidden sticky top-0 z-20 flex min-h-16 items-center gap-2 border-b border-border bg-surface px-3 text-foreground lg:px-5">
      <div className="min-w-0 flex-1 py-2">
        <p data-testid="institutional-mobile-identity" className="truncate text-xs font-semibold uppercase tracking-wider text-secondary lg:hidden">
          {hospitalName}
        </p>
        <p className="truncate text-lg font-semibold tracking-tight" data-current-location>{currentTitle}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Tag color="processing" className="m-0 px-3 py-1 text-xs font-bold">
          {cashLabel}
        </Tag>
        <span
          role="img"
          aria-label={isOnline ? 'Conexión local disponible' : 'Sin conexión al servidor local'}
          className={isOnline ? 'sr-only' : 'hidden items-center gap-1 text-sm font-semibold text-error md:flex'}
        >
          {isOnline ? 'Conexión local disponible' : (
            <>
              <DisconnectOutlined className="text-lg" />
              <span>Sin conexión</span>
            </>
          )}
        </span>
      </div>

      <Button
        ref={commandButtonRef as never}
        type="default"
        className="hidden min-w-44 justify-start bg-surface text-muted-foreground sm:inline-flex"
        onClick={onOpenCommands}
        aria-label="Abrir comandos"
        icon={<SearchOutlined />}
      >
        Buscar
        <span className="ml-auto border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">Ctrl K</span>
      </Button>

      <Tooltip title="Ayuda" mouseEnterDelay={0.4}>
        <Button
          type="text"
          icon={<QuestionCircleOutlined />}
          className="hidden sm:inline-flex"
          onClick={onOpenGuide}
          aria-label="Abrir ayuda"
        />
      </Tooltip>

      <UserMenu hospitalName={hospitalName} onLogout={onLogout} onOpenGuide={onOpenGuide} roleLabel={roleListLabel(user.roles)} user={user} />
      <span role="status" className="sr-only">{status}</span>
    </header>
  );
}
