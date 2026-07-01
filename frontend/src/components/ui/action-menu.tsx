import { MoreHorizontal } from 'lucide-react';
import { type ReactNode } from 'react';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';

export type ActionMenuItem = {
  /** Stable key used by tests / React. */
  key: string;
  /** Visible label. */
  label: string;
  /** Optional icon node (lucide icon recommended). */
  icon?: ReactNode;
  /** Disable the entry. */
  disabled?: boolean;
  /** Marks destructive entry (renders in destructive tone). */
  destructive?: boolean;
  onSelect: () => void;
};

export type ActionMenuGroup = {
  /** Stable group key. */
  key: string;
  items: ActionMenuItem[];
};

type ActionMenuProps = {
  /** Visible label for screen readers when the trigger is icon-only. */
  ariaLabel: string;
  /** Optional groups; first group renders first. Separator between groups. */
  groups: ActionMenuGroup[];
  /** When true, render trigger as ghost icon-only button (default). */
  compact?: boolean;
  /** Optional className for the trigger button. */
  triggerClassName?: string;
};

export function ActionMenu({
  ariaLabel,
  groups,
  compact = true,
  triggerClassName,
}: ActionMenuProps) {
  const totalItems = groups.reduce((acc, group) => acc + group.items.length, 0);

  if (totalItems === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={compact ? 'icon' : 'sm'}
          aria-label={ariaLabel}
          className={triggerClassName}
        >
          <MoreHorizontal data-icon aria-hidden="true" className="size-4" />
          {compact ? null : <span className="sr-only">{ariaLabel}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {groups.flatMap((group, groupIndex) =>
          group.items.map((item) => (
            <DropdownMenuItem
              key={`${group.key}-${item.key}`}
              disabled={item.disabled}
              onSelect={(event) => {
                event.preventDefault();
                if (item.disabled) {
                  return;
                }
                item.onSelect();
              }}
              className={item.destructive ? 'text-destructive focus:text-destructive' : undefined}
            >
              {item.icon ? (
                <span aria-hidden="true" className="size-4 shrink-0">
                  {item.icon}
                </span>
              ) : null}
              <span>{item.label}</span>
            </DropdownMenuItem>
          )).concat(
            groupIndex < groups.length - 1
              ? [<DropdownMenuSeparator key={`sep-${group.key}`} />]
              : [],
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}