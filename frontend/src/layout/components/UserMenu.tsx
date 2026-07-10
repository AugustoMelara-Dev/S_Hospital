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
  roleLabel: string;
  user: AuthUser;
};

export function UserMenu({
  hospitalName,
  isDark,
  onLogout,
  onOpenGuide,
  onToggleTheme,
  roleLabel,
  user,
}: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-auto gap-2 border border-white/10 px-2 py-1.5 text-white hover:border-white/20 hover:bg-white/10 hover:text-white"
          aria-label="Abrir menu de usuario"
        >
          <div className="flex size-8 items-center justify-center rounded-lg border border-[#80dfd0]/30 bg-[#80dfd0]/10 text-xs font-bold text-[#80dfd0]">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <span className="hidden max-w-[10rem] truncate text-xs lg:inline" title={user.name}>
            {user.name}
          </span>
          <ChevronDown data-icon="inline-end" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-64">
        <div className="mb-1 border-b border-border px-3 py-3 text-xs">
          <p className="font-semibold text-foreground">{user.name}</p>
          <p className="truncate font-medium text-secondary" title={roleLabel}>
            {roleLabel}
          </p>
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
