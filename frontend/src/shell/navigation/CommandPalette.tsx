import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import { type AuthUser } from '../../lib/api';
import { type AppNavigationItem } from '../../navigation/appNavigation';

export type InstitutionalCommand = {
  id: string;
  label: string;
  path: string;
  group: 'Administración' | 'Operaciones' | 'Asistencia';
  keywords: string[];
};

type CommandPaletteProps = {
  navigation: readonly AppNavigationItem[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  user: AuthUser;
};

export function buildPermittedCommands(_user: AuthUser, navigation: readonly AppNavigationItem[]): InstitutionalCommand[] {
  return navigation.map((item) => ({
    id: item.id,
    label: item.label,
    path: item.path,
    group: item.navigationGroup === 'support' ? 'Asistencia' : item.navigationGroup === 'operations' ? 'Operaciones' : 'Administración',
    keywords: [item.label, item.path, item.navigationGroup ?? 'operations'],
  }));
}

export function CommandPalette({ navigation, onOpenChange, open, user }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const commands = buildPermittedCommands(user, navigation);

  useEffect(() => {
    if (open) setSearch('');
  }, [open]);

  function selectCommand(path: string) {
    navigate(path);
    onOpenChange(false);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Comandos"
      description="Busque una pantalla permitida y presione Enter para abrirla."
      className="sm:max-w-xl"
      showCloseButton
    >
      <Command>
        <CommandInput autoFocus placeholder="Buscar pantalla o acción..." value={search} onValueChange={setSearch} />
        <CommandList>
        <CommandEmpty>No se encontraron comandos.</CommandEmpty>
        {(['Operaciones', 'Administración', 'Asistencia'] as const).map((group) => {
          const groupCommands = commands.filter((command) => command.group === group);
          if (groupCommands.length === 0) return null;
          return (
            <CommandGroup key={group} heading={group}>
              {groupCommands.map((command) => (
                <CommandItem
                  key={command.id}
                  value={`${command.label} ${command.keywords.join(' ')}`}
                  onSelect={() => selectCommand(command.path)}
                >
                  <span>{command.label}</span>
                  <CommandShortcut>{command.group}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
