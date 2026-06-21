import { Slot } from '@radix-ui/react-slot';
import { ChevronRight } from 'lucide-react';
import { forwardRef, type ComponentPropsWithoutRef, type HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export const Breadcrumb = forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(function Breadcrumb(
  { className, ...props },
  ref,
) {
  return <nav ref={ref} data-slot="breadcrumb" aria-label="Ruta actual" className={cn(className)} {...props} />;
});

export const BreadcrumbList = forwardRef<HTMLOListElement, HTMLAttributes<HTMLOListElement>>(function BreadcrumbList(
  { className, ...props },
  ref,
) {
  return (
    <ol
      ref={ref}
      data-slot="breadcrumb-list"
      className={cn('flex min-w-0 flex-wrap items-center gap-1.5 break-words text-xs text-muted-foreground', className)}
      {...props}
    />
  );
});

export const BreadcrumbItem = forwardRef<HTMLLIElement, HTMLAttributes<HTMLLIElement>>(function BreadcrumbItem(
  { className, ...props },
  ref,
) {
  return <li ref={ref} data-slot="breadcrumb-item" className={cn('inline-flex min-w-0 items-center gap-1.5', className)} {...props} />;
});

export const BreadcrumbLink = forwardRef<HTMLAnchorElement, ComponentPropsWithoutRef<'a'> & { asChild?: boolean }>(
  function BreadcrumbLink({ asChild = false, className, ...props }, ref) {
    const Comp = asChild ? Slot : 'a';

    return (
      <Comp
        ref={ref}
        data-slot="breadcrumb-link"
        className={cn(
          'min-w-0 truncate rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          className,
        )}
        {...props}
      />
    );
  },
);

export const BreadcrumbPage = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(function BreadcrumbPage(
  { className, ...props },
  ref,
) {
  return (
    <span
      ref={ref}
      data-slot="breadcrumb-page"
      aria-current="page"
      className={cn('min-w-0 truncate font-semibold text-foreground', className)}
      {...props}
    />
  );
});

export function BreadcrumbSeparator({ className, children, ...props }: HTMLAttributes<HTMLLIElement>) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn('flex items-center text-border', className)}
      {...props}
    >
      {children ?? <ChevronRight className="size-3.5" />}
    </li>
  );
}

