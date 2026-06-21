import { ChevronDown, HelpCircle, LogOut, Moon, Sun } from 'lucide-react';
import { Button } from '../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { type AuthUser } from '../../lib/api';

type UserMenuProps = {
  hospitalName: string;
  isDark: boolean;
  onLogout: () => void;
  onOpenGuide: () => void;
  onToggleTheme: () => void;
  user: AuthUser;
};

export function UserMenu({
  hospitalName,
  isDark,
  onLogout,
  onOpenGuide,
  onToggleTheme,
  user,
}: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" className="h-auto gap-2 px-2 py-1.5" aria-label="Abrir menu de usuario">
          <div className="flex size-7 items-center justify-center rounded-md border border-border bg-muted text-xs font-bold text-secondary">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <span className="hidden max-w-[10rem] truncate text-xs lg:inline" title={user.name}>
            {user.name}
          </span>
          <ChevronDown data-icon="inline-end" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-60">
        <div className="mb-1 border-b border-border px-3 py-2 text-xs">
          <p className="font-semibold text-foreground">{user.name}</p>
          <p className="truncate text-muted-foreground" title={hospitalName}>
            {hospitalName}
          </p>
        </div>
        <DropdownMenuItem className="sm:hidden" onSelect={onOpenGuide}>
          <HelpCircle data-icon aria-hidden="true" />
          Ayuda
        </DropdownMenuItem>
        <DropdownMenuItem className="sm:hidden" onSelect={onToggleTheme}>
          {isDark ? <Sun data-icon aria-hidden="true" /> : <Moon data-icon aria-hidden="true" />}
          {isDark ? 'Cambiar a claro' : 'Cambiar a oscuro'}
        </DropdownMenuItem>
        <DropdownMenuSeparator className="sm:hidden" />
        <DropdownMenuItem
          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          onSelect={onLogout}
        >
          <LogOut data-icon aria-hidden="true" />
          Cerrar sesion
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

