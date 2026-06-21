import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';

type FormSectionProps = HTMLAttributes<HTMLElement> & {
  actions?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  title?: ReactNode;
};

export function FormSection({
  actions,
  children,
  className,
  description,
  footer,
  title,
  ...props
}: FormSectionProps) {
  return (
    <Card data-slot="form-section" className={cn('overflow-hidden', className)} {...props}>
      {(title || description || actions) ? (
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title ? <CardTitle>{title}</CardTitle> : null}
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </CardHeader>
      ) : null}
      <CardContent className={cn(!(title || description || actions) && 'pt-5')}>{children}</CardContent>
      {footer ? <div data-slot="form-section-footer" className="border-t border-border p-5">{footer}</div> : null}
    </Card>
  );
}

type FieldGroupProps = HTMLAttributes<HTMLDivElement> & {
  columns?: 1 | 2 | 3 | 4;
};

const columnClasses: Record<NonNullable<FieldGroupProps['columns']>, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4',
};

export function FieldGroup({ children, className, columns = 2, ...props }: FieldGroupProps) {
  return (
    <div data-slot="field-group" className={cn('grid gap-4', columnClasses[columns], className)} {...props}>
      {children}
    </div>
  );
}
