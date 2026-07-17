import { MenuOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { Button, Drawer } from 'antd';
import { cn } from '../../lib/utils';
import { type AppNavigationItem } from '../../navigation/appNavigation';

type InstitutionalMobileNavProps = {
  activeItem: AppNavigationItem | undefined;
  navigation: readonly AppNavigationItem[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function InstitutionalMobileNav({ activeItem, navigation, onOpenChange, open }: InstitutionalMobileNavProps) {
  const dockItems = navigation.slice(0, 4);
  const remainingItems = navigation.slice(4);

  return (
    <>
      <nav aria-label="Accesos móviles" className="print-hidden fixed inset-x-0 bottom-0 z-30 flex min-h-20 items-stretch border-t border-sidebar-border bg-sidebar px-1 pb-4 text-sidebar-foreground lg:hidden">
        {dockItems.length === 0 ? (
          <p className="flex flex-1 items-center justify-center px-4 text-center text-xs text-sidebar-foreground/70">
            No hay destinos móviles disponibles.
          </p>
        ) : null}
        {dockItems.map((item) => {
          const Icon = item.icon;
          const active = activeItem?.id === item.id;
          return (
            <Link
              key={item.id}
              to={item.path}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                active ? 'bg-sidebar-accent text-sidebar-primary' : 'text-sidebar-foreground/65'
              )}
            >
              <Icon className="text-lg" aria-hidden="true" />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
        {remainingItems.length > 0 ? (
          <Button
            htmlType="button"
            type="text"
            className="flex h-auto min-w-14 flex-1 cursor-pointer flex-col items-center justify-center gap-1 px-2 py-2 text-xs text-sidebar-foreground/65 outline-none transition hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            aria-label="Más destinos"
            onClick={() => onOpenChange(true)}
          >
            <MenuOutlined className="text-lg" aria-hidden="true" />
            <span>Más</span>
          </Button>
        ) : null}
      </nav>

      <Drawer
        title="Más destinos"
        placement="bottom"
        onClose={() => onOpenChange(false)}
        open={open}
        styles={{ body: { padding: '16px' } }}
        classNames={{ header: 'border-b border-border' }}
        size="default"
      >
        <p className="text-xs text-muted-foreground mb-4">Pantallas permitidas para su usuario.</p>
        <ul className="grid gap-2 overflow-y-auto sm:grid-cols-2">
          {remainingItems.map((item) => {
            const Icon = item.icon;
            const active = activeItem?.id === item.id;
            return (
              <li key={item.id}>
                <Link
                  to={item.path}
                  onClick={() => onOpenChange(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-11 items-center gap-3 border px-3 py-2 text-sm font-medium',
                    active ? 'border-primary bg-primary/10 text-primary' : 'border-border'
                  )}
                >
                  <Icon className="text-lg" aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </Drawer>
    </>
  );
}
