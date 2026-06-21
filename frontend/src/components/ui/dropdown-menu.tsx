import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { cn } from '../../lib/utils';

export function DropdownMenu({ ...props }: DropdownMenuPrimitive.DropdownMenuProps) {
  return <DropdownMenuPrimitive.Root {...props} />;
}

export function DropdownMenuTrigger({ className, ...props }: DropdownMenuPrimitive.DropdownMenuTriggerProps) {
  return <DropdownMenuPrimitive.Trigger className={cn(className)} {...props} />;
}

export function DropdownMenuContent({ className, sideOffset = 4, ...props }: DropdownMenuPrimitive.DropdownMenuContentProps) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-[8rem] overflow-hidden rounded-md border bg-card p-1 text-card-foreground shadow-lg',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({ className, inset, ...props }: DropdownMenuPrimitive.DropdownMenuItemProps & { inset?: boolean }) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        'relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-muted focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        inset && 'pl-8',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({ className, ...props }: DropdownMenuPrimitive.DropdownMenuSeparatorProps) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn('-mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  );
}
