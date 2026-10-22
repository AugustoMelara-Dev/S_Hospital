import { forwardRef, type ComponentPropsWithoutRef, type ComponentRef } from 'react';
import { DropdownMenu } from 'radix-ui';
import { cn } from '@/lib/utils';

/** Menús operativos: misma tipografía, foco y controles que las tablas y diálogos. */
export const AdminMenuRoot = DropdownMenu.Root;
export const AdminMenuTrigger = DropdownMenu.Trigger;

export const AdminMenuContent = forwardRef<
  ComponentRef<typeof DropdownMenu.Content>,
  ComponentPropsWithoutRef<typeof DropdownMenu.Content>
>(({ className, sideOffset = 6, align = 'end', ...props }, ref) => (
  <DropdownMenu.Portal>
    <DropdownMenu.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'ui-portal ui-portal-surface z-50 min-w-48 max-w-[calc(100vw-2rem)] overflow-hidden rounded-[var(--ui-radius-panel)] border border-[var(--ui-line)] bg-[var(--ui-elevated)] p-1.5',
        className,
      )}
      {...props}
    />
  </DropdownMenu.Portal>
));
AdminMenuContent.displayName = 'AdminMenuContent';

export const AdminMenuItem = forwardRef<
  ComponentRef<typeof DropdownMenu.Item>,
  ComponentPropsWithoutRef<typeof DropdownMenu.Item> & { destructive?: boolean; variant?: 'default' | 'destructive'; inset?: boolean }
>(({ className, destructive, variant, inset, ...props }, ref) => (
  <DropdownMenu.Item
    ref={ref}
    className={cn(
      'flex min-h-10 cursor-default items-center gap-2 rounded-[var(--ui-radius)] px-3 py-2 text-[length:var(--ui-text-base)] outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-45 data-[highlighted]:bg-[var(--ui-action-subtle)] data-[highlighted]:text-[var(--ui-action)] [&_svg]:size-4 [&_svg]:shrink-0',
      destructive || variant === 'destructive' ? 'text-[var(--ui-danger)] data-[highlighted]:bg-[var(--ui-danger-subtle)] data-[highlighted]:text-[var(--ui-danger)]' : 'text-[var(--ui-ink)]',
      inset && 'pl-9',
      className,
    )}
    {...props}
  />
));
AdminMenuItem.displayName = 'AdminMenuItem';

export function AdminMenuSeparator({ className, ...props }: ComponentPropsWithoutRef<typeof DropdownMenu.Separator>) {
  return <DropdownMenu.Separator className={cn('my-1 h-px bg-[var(--ui-line)]', className)} {...props} />;
}
