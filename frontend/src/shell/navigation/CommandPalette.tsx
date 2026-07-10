import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { Search, X } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { type AuthUser } from '../../lib/api';
import { type AppNavigationItem } from '../../navigation/appNavigation';

export type ClinicalCommand = {
  id: string;
  label: string;
  path: string;
  group: 'Navegación' | 'Operación' | 'Ayuda';
  keywords: string[];
};

type CommandPaletteProps = {
  navigation: readonly AppNavigationItem[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  user: AuthUser;
};

export function buildPermittedCommands(_user: AuthUser, navigation: readonly AppNavigationItem[]): ClinicalCommand[] {
  return navigation.map((item) => ({
    id: item.id,
    label: item.label,
    path: item.path,
    group: item.navigationGroup === 'support' ? 'Ayuda' : item.navigationGroup === 'operations' ? 'Operación' : 'Navegación',
    keywords: [item.label, item.path, item.navigationGroup ?? 'operations'],
  }));
}

export function CommandPalette({ navigation, onOpenChange, open, user }: CommandPaletteProps) {
  const navigate = useNavigate();
  const commands = buildPermittedCommands(user, navigation);

  useEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    return () => {
      if (active instanceof HTMLElement) active.focus();
    };
  }, [open]);

  function select(path: string) {
    navigate(path);
    onOpenChange(false);
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/55" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[15vh] z-50 w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-card shadow-xl outline-none">
          <DialogPrimitive.Title className="sr-only">Comandos</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Busque una pantalla permitida y navegue sin abandonar el teclado.</DialogPrimitive.Description>
          <DialogPrimitive.Close asChild>
            <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-2 z-10" aria-label="Cerrar comandos">
              <X aria-hidden="true" />
            </Button>
          </DialogPrimitive.Close>
          <Command label="Comandos" className="[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-muted-foreground">
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search className="size-5 text-muted-foreground" aria-hidden="true" />
              <Command.Input autoFocus aria-label="Buscar pantalla o acción" placeholder="Buscar pantalla o acción" className="h-14 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            </div>
            <Command.List className="max-h-[min(24rem,60vh)] overflow-y-auto p-2">
              <Command.Empty className="p-6 text-center text-sm text-muted-foreground">No se encontraron comandos.</Command.Empty>
              {(['Operación', 'Navegación', 'Ayuda'] as const).map((group) => {
                const groupCommands = commands.filter((command) => command.group === group);
                if (groupCommands.length === 0) return null;
                return (
                  <Command.Group key={group} heading={group}>
                    {groupCommands.map((command) => (
                      <Command.Item
                        key={command.id}
                        value={`${command.label} ${command.keywords.join(' ')}`}
                        onSelect={() => select(command.path)}
                        className="flex min-h-11 cursor-default items-center rounded-md px-3 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                      >
                        {command.label}
                      </Command.Item>
                    ))}
                  </Command.Group>
                );
              })}
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
