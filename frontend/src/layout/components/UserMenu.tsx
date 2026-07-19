import { ChevronDownIcon, CircleHelpIcon, LogOutIcon } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { type AuthUser } from '../../lib/api';

type UserMenuProps = {
  hospitalName: string;
  onLogout: () => void;
  onOpenGuide: () => void;
  roleLabel: string;
  user: AuthUser;
};

export function UserMenu({ hospitalName, onLogout, onOpenGuide, roleLabel, user }: UserMenuProps) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-10 gap-2 px-2" aria-label="Abrir menú de usuario">
          <Avatar size="sm"><AvatarFallback>{user.name.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
          <span className="hidden max-w-40 truncate text-xs lg:inline" title={user.name}>{user.name}</span>
          <ChevronDownIcon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
          <span className="font-semibold text-foreground">{user.name}</span>
          <span className="truncate text-xs text-muted-foreground" title={roleLabel}>{roleLabel}</span>
          <span className="truncate text-xs text-muted-foreground" title={hospitalName}>{hospitalName}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="sm:hidden" onSelect={onOpenGuide}>
          <CircleHelpIcon /> Ayuda
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={onLogout}>
          <LogOutIcon /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
