import { KeyRound, MoreHorizontal, Pencil, UserCheck, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { AuthUser } from '@/lib/api';

type UserActionMenuProps = { canDisableUsers: boolean; canResetPassword: boolean; canUpdateUsers: boolean; onEdit: (user: AuthUser) => void; onResetPassword: (user: AuthUser) => void; onToggleActive: (user: AuthUser) => void; user: AuthUser };

export function UserActionMenu({ canDisableUsers, canResetPassword, canUpdateUsers, onEdit, onResetPassword, onToggleActive, user }: UserActionMenuProps) {
  if (!canUpdateUsers && !canResetPassword && !canDisableUsers) return null;
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label={`Acciones de usuario ${user.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuGroup>
    {canUpdateUsers ? <DropdownMenuItem onSelect={() => onEdit(user)}><Pencil />Editar</DropdownMenuItem> : null}
    {canResetPassword ? <DropdownMenuItem onSelect={() => onResetPassword(user)}><KeyRound />Restablecer clave</DropdownMenuItem> : null}
  </DropdownMenuGroup>{canDisableUsers ? <><DropdownMenuSeparator /><DropdownMenuGroup><DropdownMenuItem variant={user.active ? 'destructive' : 'default'} onSelect={() => onToggleActive(user)}>{user.active ? <UserX /> : <UserCheck />}{user.active ? 'Desactivar' : 'Activar'}</DropdownMenuItem></DropdownMenuGroup></> : null}</DropdownMenuContent></DropdownMenu>;
}
