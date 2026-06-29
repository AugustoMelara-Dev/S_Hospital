import { HelpCircle, Menu, Moon, PanelLeftClose, PanelLeftOpen, Sun } from 'lucide-react';
import { type RefObject, useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { usePublicBranding } from '../hooks/useFiscalSettings';
import { useServerStatus } from '../hooks/useServerStatus';
import { useTheme } from '../hooks/useTheme';
import { type AuthUser, type CashSession } from '../lib/api';
import { displayHospitalName } from '../lib/hospital-name';
import { type AppBreadcrumb } from '../navigation/appNavigation';
import { AppBreadcrumbs } from './components/AppBreadcrumbs';
import { OperationalStatus } from './components/OperationalStatus';
import { UserMenu } from './components/UserMenu';

interface TopbarProps {
  cashSession: CashSession | null;
  user: AuthUser;
  status: string;
  isMinimalTopbar?: boolean;
  crumbs: AppBreadcrumb[];
  canLinkToBreadcrumb?: (path: string) => boolean;
  mobileMenuButtonRef: RefObject<HTMLButtonElement | null>;
  onOpenMobileMenu: () => void;
  onOpenGuide: () => void;
  onLogout: () => void;
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
}

export function Topbar({
  cashSession,
  user,
  status,
  isMinimalTopbar = false,
  crumbs,
  canLinkToBreadcrumb,
  mobileMenuButtonRef,
  onOpenMobileMenu,
  onOpenGuide,
  onLogout,
  onToggleSidebar,
  sidebarCollapsed,
}: TopbarProps) {
  const { setTheme, isDark } = useTheme();
  const { isOnline, lastCheck } = useServerStatus();
  const { data: fiscal } = usePublicBranding();
  const [now, setNow] = useState(() => new Date());
  const hospitalName = displayHospitalName(fiscal?.hospital_name);
  const roleLabel = user.roles.length > 0 ? user.roles.join(', ') : 'Sin rol';
  const currentCrumb = crumbs.at(-1);
  const currentTitle = currentCrumb?.label ?? 'Inicio';
  const localTime = new Intl.DateTimeFormat('es-HN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(now);
  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <TooltipProvider>
      <header className="print-hidden sticky top-0 z-10 flex min-h-14 items-center gap-2 border-b border-operational-border bg-operational-surface/98 px-3 text-card-foreground shadow-sm lg:px-5">
        <Button
          ref={mobileMenuButtonRef}
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 lg:hidden"
          onClick={onOpenMobileMenu}
          aria-label="Abrir menú"
        >
          <Menu data-icon="inline-start" aria-hidden="true" />
        </Button>

        {!isMinimalTopbar ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden shrink-0 lg:inline-flex"
            onClick={onToggleSidebar}
            aria-pressed={sidebarCollapsed}
            aria-label={sidebarCollapsed ? 'Expandir menu lateral' : 'Colapsar menu lateral'}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen data-icon="inline-start" aria-hidden="true" />
            ) : (
              <PanelLeftClose data-icon="inline-start" aria-hidden="true" />
            )}
          </Button>
        ) : null}

        <div className="min-w-0 flex-1 py-2">
          {!isMinimalTopbar ? (
            <p className="hidden truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground md:block" title={hospitalName}>
              {hospitalName}
            </p>
          ) : null}
          <p className="truncate text-sm font-semibold leading-tight text-foreground sm:text-base" title={currentTitle}>
            {currentTitle}
          </p>
          {!isMinimalTopbar ? (
            <AppBreadcrumbs
              crumbs={crumbs}
              canLinkTo={canLinkToBreadcrumb}
              className="mt-1 hidden w-fit max-w-full text-xs sm:block"
            />
          ) : null}
        </div>

        {!isMinimalTopbar ? (
          <OperationalStatus
            cashSession={cashSession}
            isOnline={isOnline}
            lastCheck={lastCheck}
            localTime={localTime}
            now={now}
            status={status}
          />
        ) : null}

        <div className="flex shrink-0 items-center gap-1">
          {!isMinimalTopbar ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="hidden sm:inline-flex"
                  onClick={onOpenGuide}
                  aria-label="Abrir ayuda"
                >
                  <HelpCircle data-icon="inline-start" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ayuda operativa</TooltipContent>
            </Tooltip>
          ) : null}

          {!isMinimalTopbar ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="hidden sm:inline-flex"
                  onClick={toggleTheme}
                  aria-label={isDark ? 'Cambiar a claro' : 'Cambiar a oscuro'}
                >
                  {isDark ? <Sun data-icon="inline-start" aria-hidden="true" /> : <Moon data-icon="inline-start" aria-hidden="true" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isDark ? 'Cambiar a claro' : 'Cambiar a oscuro'}</TooltipContent>
            </Tooltip>
          ) : null}

          <UserMenu
            hospitalName={hospitalName}
            isDark={isDark}
            onLogout={onLogout}
            onOpenGuide={onOpenGuide}
            onToggleTheme={toggleTheme}
            roleLabel={roleLabel}
            user={user}
          />
        </div>
      </header>
    </TooltipProvider>
  );
}
