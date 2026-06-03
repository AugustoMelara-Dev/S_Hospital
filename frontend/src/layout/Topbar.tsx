import {
  ChevronDown,
  HelpCircle,
  KeyRound,
  LogOut,
  Menu,
  Moon,
  Sun,
  Wifi,
  WifiOff,
} from 'lucide-react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { NavLink } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { useFiscalSettings } from '../hooks/useFiscalSettings';
import { useServerStatus } from '../hooks/useServerStatus';
import { useTheme } from '../hooks/useTheme';
import { type AuthUser } from '../lib/api';
import { displayHospitalName } from '../lib/hospital-name';
import { cn } from '../lib/utils';

interface TopbarProps {
  user: AuthUser;
  status: string;
  isMinimalTopbar?: boolean;
  crumbs: Array<{ label: string; path: string }>;
  onOpenMobileMenu: () => void;
  onOpenGuide: () => void;
  onOpenChangePassword: () => void;
  onLogout: () => void;
}

export function Topbar({
  user,
  status,
  isMinimalTopbar = false,
  crumbs,
  onOpenMobileMenu,
  onOpenGuide,
  onOpenChangePassword,
  onLogout,
}: TopbarProps) {
  const { setTheme, isDark } = useTheme();
  const { isOnline, lastCheck } = useServerStatus();
  const { data: fiscal } = useFiscalSettings();
  const hospitalName = displayHospitalName(fiscal?.hospital_name);
  const lanStatusTitle = isOnline
    ? `Red local disponible${lastCheck ? `. Ultima revision: ${lastCheck.toLocaleTimeString()}` : ''}`
    : `Sin conexion al servidor local. Estado: ${status}`;

  return (
    <header className="print-hidden sticky top-0 z-10 flex min-h-16 items-center gap-3 border-b border-border bg-card/95 px-4 shadow-sm backdrop-blur-sm lg:px-6">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0 lg:hidden"
        onClick={onOpenMobileMenu}
        aria-label="Abrir menu"
      >
        <Menu data-icon="inline-start" aria-hidden="true" />
      </Button>

      <div className="min-w-0 flex-1">
        {!isMinimalTopbar && (
          <nav className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground" aria-label="Ubicacion">
            {crumbs.map((crumb, index) => (
              <div key={`${crumb.path}-${index}`} className="flex min-w-0 items-center gap-1.5">
                {index > 0 && <span className="text-border">/</span>}
                {index === crumbs.length - 1 ? (
                  <span className="max-w-[8rem] truncate font-semibold text-foreground sm:max-w-none">
                    {crumb.label}
                  </span>
                ) : (
                  <NavLink to={crumb.path} className="max-w-[5rem] truncate transition-colors hover:text-foreground sm:max-w-none">
                    {crumb.label}
                  </NavLink>
                )}
              </div>
            ))}
          </nav>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {!isMinimalTopbar && (
          <div
            className={cn(
              'hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold sm:flex',
              isOnline ? 'border-secondary/30 bg-secondary/10 text-secondary' : 'border-destructive/30 bg-destructive/10 text-destructive',
            )}
            title={lanStatusTitle}
          >
            {isOnline ? <Wifi data-icon="inline-start" aria-hidden="true" /> : <WifiOff data-icon="inline-start" aria-hidden="true" />}
            <span>{isOnline ? 'Red local' : 'Sin red'}</span>
          </div>
        )}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onOpenGuide}
          title="Ayuda"
          aria-label="Abrir ayuda"
        >
          <HelpCircle data-icon="inline-start" aria-hidden="true" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          title={isDark ? 'Cambiar a claro' : 'Cambiar a oscuro'}
          aria-label={isDark ? 'Cambiar a claro' : 'Cambiar a oscuro'}
        >
          {isDark ? <Sun data-icon="inline-start" aria-hidden="true" /> : <Moon data-icon="inline-start" aria-hidden="true" />}
        </Button>

        <DropdownMenuPrimitive.Root>
          <DropdownMenuPrimitive.Trigger asChild>
            <Button type="button" variant="ghost" className="h-auto gap-2 px-2 py-1.5" aria-label="Abrir menu de usuario">
              <div className="flex size-7 items-center justify-center rounded-full border border-border bg-muted text-xs font-bold text-secondary">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="hidden max-w-[10rem] truncate text-xs lg:inline" title={user.name}>
                {user.name}
              </span>
              <ChevronDown data-icon="inline-end" aria-hidden="true" />
            </Button>
          </DropdownMenuPrimitive.Trigger>
          <DropdownMenuPrimitive.Portal>
            <DropdownMenuPrimitive.Content
              align="end"
              className="z-50 min-w-56 rounded-md border border-border bg-card p-1 text-card-foreground shadow-lg data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
              sideOffset={8}
            >
              <div className="mb-1 border-b border-border px-3 py-2 text-xs">
                <p className="font-semibold text-foreground">{user.name}</p>
                <p className="truncate text-muted-foreground" title={hospitalName}>
                  {hospitalName}
                </p>
              </div>
              <DropdownMenuPrimitive.Item
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-foreground outline-none transition-colors hover:bg-muted focus:bg-muted"
                onSelect={(event) => {
                  event.preventDefault();
                  onOpenChangePassword();
                }}
              >
                <KeyRound data-icon="inline-start" aria-hidden="true" />
                Cambiar mi contraseña
              </DropdownMenuPrimitive.Item>
              <DropdownMenuPrimitive.Item
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-destructive outline-none transition-colors hover:bg-destructive/10 focus:bg-destructive/10"
                onClick={onLogout}
              >
                <LogOut data-icon="inline-start" aria-hidden="true" />
                Cerrar sesion
              </DropdownMenuPrimitive.Item>
            </DropdownMenuPrimitive.Content>
          </DropdownMenuPrimitive.Portal>
        </DropdownMenuPrimitive.Root>
      </div>
    </header>
  );
}
