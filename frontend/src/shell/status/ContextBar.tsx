import { CircleHelp, Keyboard, Moon, Search, Sun, Wifi, WifiOff } from 'lucide-react';
import { type RefObject } from 'react';
import { Button } from '../../components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../components/ui/tooltip';
import { useServerStatus } from '../../hooks/useServerStatus';
import { useTheme } from '../../hooks/useTheme';
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
  const { isDark, setTheme } = useTheme();
  const currentTitle = crumbs.at(-1)?.label ?? 'Inicio';
  const cashLabel = cashSession?.status === 'open' ? `Caja #${cashSession.id}` : 'Caja cerrada';
  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');

  return (
    <TooltipProvider>
      <header className="print-hidden sticky top-0 z-20 flex min-h-16 items-center gap-2 border-b border-border bg-card/95 px-3 shadow-sm backdrop-blur lg:px-5">
        <div className="min-w-0 flex-1 py-2">
          <p data-testid="clinical-mobile-identity" className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground lg:hidden">
            {hospitalName}
          </p>
          <p className="truncate text-base font-semibold">{currentTitle}</p>
          <AppBreadcrumbs crumbs={crumbs} className="mt-1 hidden sm:block" />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-md border border-secondary/35 bg-secondary/10 px-3 py-2 font-mono text-xs font-semibold tabular-nums">{cashLabel}</span>
          <span
            role="img"
            aria-label={isOnline ? 'Conexión local disponible' : 'Sin conexión al servidor local'}
            className={isOnline ? 'hidden text-success md:inline-flex' : 'hidden items-center gap-1 text-sm font-semibold text-destructive md:flex'}
          >
            {isOnline ? <Wifi className="size-5" aria-hidden="true" /> : <><WifiOff className="size-5" aria-hidden="true" /><span>Sin conexión</span></>}
          </span>
        </div>

        <Button ref={commandButtonRef} type="button" variant="outline" className="hidden min-w-40 justify-start text-muted-foreground sm:inline-flex" onClick={onOpenCommands} aria-label="Abrir comandos">
          <Search aria-hidden="true" />
          Buscar
          <kbd className="ml-auto font-mono text-[10px]">Ctrl K</kbd>
        </Button>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="hidden sm:inline-flex" onClick={onOpenShortcuts} aria-label="Ver atajos de teclado">
              <Keyboard aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Atajos (?)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="hidden sm:inline-flex" onClick={onOpenGuide} aria-label="Abrir ayuda">
              <CircleHelp aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Ayuda</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="hidden sm:inline-flex" onClick={toggleTheme} aria-label={isDark ? 'Cambiar a claro' : 'Cambiar a oscuro'}>
              {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isDark ? 'Tema claro' : 'Tema oscuro'}</TooltipContent>
        </Tooltip>
        <UserMenu hospitalName={hospitalName} isDark={isDark} onLogout={onLogout} onOpenGuide={onOpenGuide} onToggleTheme={toggleTheme} roleLabel={roleListLabel(user.roles)} user={user} />
        <span role="status" className="sr-only">{status}</span>
      </header>
    </TooltipProvider>
  );
}
