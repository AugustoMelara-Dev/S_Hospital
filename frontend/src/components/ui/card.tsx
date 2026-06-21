import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export const Card = forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(function Card({ className, ...props }, ref) {
  return (
    <section
      ref={ref}
      data-slot="card"
      className={cn(
        'rounded-md border border-border bg-card text-card-foreground shadow-sm',
        className,
      )}
      {...props}
    />
  );
});

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function CardHeader({ className, ...props }, ref) {
  return <div ref={ref} data-slot="card-header" className={cn('flex flex-col gap-1.5 p-5', className)} {...props} />;
});

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(function CardTitle({ className, children, ...props }, ref) {
  return <h2 ref={ref} data-slot="card-title" className={cn('text-lg font-semibold leading-tight', className)} {...props}>{children}</h2>;
});

export const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(function CardDescription({ className, ...props }, ref) {
  return <p ref={ref} data-slot="card-description" className={cn('text-sm leading-relaxed text-muted-foreground', className)} {...props} />;
});

export const CardAction = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function CardAction({ className, ...props }, ref) {
  return <div ref={ref} data-slot="card-action" className={cn('flex items-center gap-2 self-start sm:ml-auto', className)} {...props} />;
});

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function CardContent({ className, ...props }, ref) {
  return <div ref={ref} data-slot="card-content" className={cn('p-5 pt-0', className)} {...props} />;
});

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function CardFooter({ className, ...props }, ref) {
  return <div ref={ref} data-slot="card-footer" className={cn('flex flex-wrap items-center gap-2 p-5 pt-0', className)} {...props} />;
});

Card.displayName = 'Card';
CardHeader.displayName = 'CardHeader';
CardTitle.displayName = 'CardTitle';
CardDescription.displayName = 'CardDescription';
CardAction.displayName = 'CardAction';
CardContent.displayName = 'CardContent';
CardFooter.displayName = 'CardFooter';
