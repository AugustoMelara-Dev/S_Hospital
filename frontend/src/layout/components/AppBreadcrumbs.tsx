import { Link } from 'react-router-dom';
import { Fragment } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../../components/ui/breadcrumb';
import { cn } from '../../lib/utils';
import { type AppBreadcrumb } from '../../navigation/appNavigation';

type AppBreadcrumbsProps = {
  crumbs: AppBreadcrumb[];
  canLinkTo?: (path: string) => boolean;
  className?: string;
};

export function AppBreadcrumbs({ canLinkTo = () => true, className, crumbs }: AppBreadcrumbsProps) {
  if (crumbs.length === 0) {
    return (
      <Breadcrumb className={cn('min-w-0', className)}>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Sin registro</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  return (
    <Breadcrumb className={cn('min-w-0', className)}>
      <BreadcrumbList>
        {crumbs.map((crumb, index) => {
          const isCurrent = index === crumbs.length - 1;
          const isSecondaryOnMobile = index > 0 && !isCurrent;

          return (
            <Fragment key={`${crumb.path}-${index}`}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem className={cn(isSecondaryOnMobile && 'max-sm:sr-only')}>
                {isCurrent || !canLinkTo(crumb.path) ? (
                  <BreadcrumbPage className="max-w-[10rem] sm:max-w-none">{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild className="max-w-[6rem] sm:max-w-none">
                    <Link to={crumb.path}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
