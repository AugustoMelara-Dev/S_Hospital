import {
  DisconnectOutlined,
  KeyOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  WifiOutlined,
} from '@ant-design/icons';
import { type RefObject } from 'react';
import { Button, Tooltip, Tag } from 'antd';
import { useServerStatus } from '../../hooks/useServerStatus';
import { type AuthUser, type CashSession } from '../../lib/api';
import { roleListLabel } from '../../lib/role-labels';
import { type AppBreadcrumb } from '../../navigation/appNavigation';
import { AppBreadcrumbs } from '../../layout/components/AppBreadcrumbs';
import { UserMenu } from '../../layout/components/UserMenu';

type ContextBarProps = {
  cashSession: CashSession | null;
  commandButtonRef: RefObject<HTMLButtonElement | null>;
  crumbs: AppBreadcrumb[];
  hospitalName: string;
  onLogout: () => void;
  onOpenCommands: () => void;
  onOpenGuide: () => void;
  onOpenShortcuts: () => void;
  status: string;
  user: AuthUser;
};

export function ContextBar({ cashSession, commandButtonRef, crumbs, hospitalName, onLogout, onOpenCommands, onOpenGuide, onOpenShortcuts, status, user }: ContextBarProps) {
  const { isOnline } = useServerStatus();
  const currentTitle = crumbs.at(-1)?.label ?? 'Inicio';
  const cashLabel = cashSession?.status === 'open' ? `Caja #${cashSession.id}` : 'Caja cerrada';

  return (
    <header className="print-hidden sticky top-0 z-20 flex min-h-[76px] items-center gap-2 border-b border-border bg-surface px-3 text-foreground lg:px-6">
      <div className="min-w-0 flex-1 py-2">
        <p data-testid="institutional-mobile-identity" className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-secondary lg:hidden">
          {hospitalName}
        </p>
        <p className="truncate text-lg font-semibold tracking-tight">{currentTitle}</p>
        <AppBreadcrumbs
          crumbs={crumbs}
          className="mt-1 hidden text-muted-foreground sm:block"
        />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Tag color="processing" style={{ borderRadius: 0, margin: 0, padding: '4px 12px', fontSize: '12px', fontWeight: 'bold' }}>
          {cashLabel}
        </Tag>
        <span
          role="img"
          aria-label={isOnline ? 'Conexión local disponible' : 'Sin conexión al servidor local'}
          className={isOnline ? 'hidden text-success md:inline-flex' : 'hidden items-center gap-1 text-sm font-semibold text-destructive md:flex'}
        >
          {isOnline ? (
            <WifiOutlined className="text-lg text-green-600" />
          ) : (
            <>
              <DisconnectOutlined className="text-lg text-red-600" />
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
        <span className="ml-auto border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">Ctrl K</span>
      </Button>

      <Tooltip title="Atajos (?)" mouseEnterDelay={0.4}>
        <Button
          type="text"
          icon={<KeyOutlined />}
          className="hidden sm:inline-flex"
          onClick={onOpenShortcuts}
          aria-label="Ver atajos de teclado"
        />
      </Tooltip>

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
