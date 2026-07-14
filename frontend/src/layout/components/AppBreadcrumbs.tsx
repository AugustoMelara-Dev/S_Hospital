import { Link } from 'react-router-dom';
import { Breadcrumb } from 'antd';
import { cn } from '../../lib/utils';
import { type AppBreadcrumb } from '../../navigation/appNavigation';

type AppBreadcrumbsProps = {
  crumbs: AppBreadcrumb[];
  canLinkTo?: (path: string) => boolean;
  className?: string;
};

export function AppBreadcrumbs({ canLinkTo = () => true, className, crumbs }: AppBreadcrumbsProps) {
  if (crumbs.length === 0) {
    return <Breadcrumb aria-label="Ruta actual" className={cn('min-w-0', className)} items={[{ title: 'Sin registro' }]} />;
  }

  return (
    <Breadcrumb
      aria-label="Ruta actual"
      className={cn('min-w-0', className)}
      items={crumbs.map((crumb, index) => {
          const isCurrent = index === crumbs.length - 1;
          return {
            title: isCurrent
              ? <span aria-current="page">{crumb.label}</span>
              : !canLinkTo(crumb.path) ? crumb.label : <Link to={crumb.path}>{crumb.label}</Link>,
          };
        })}
    />
  );
}
