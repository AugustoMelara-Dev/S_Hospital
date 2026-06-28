import { CircleDollarSign, Network, ShieldCheck, User } from 'lucide-react';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import { usePublicBranding } from '../hooks/useFiscalSettings';
import { type AuthUser, type CashSession } from '../lib/api';
import { displayHospitalName } from '../lib/hospital-name';
import { type AppNavigationItem } from '../navigation/appNavigation';
import { SidebarSection } from './components/SidebarSection';

interface SidebarProps {
  user: AuthUser;
  cashSession: CashSession | null;
  visibleNavigation: AppNavigationItem[];
  activeItem: AppNavigationItem | undefined;
  logoUrl?: string | null;
  onNavigate?: () => void;
}

export function SidebarContent({
  user,
  cashSession,
  visibleNavigation,
  activeItem,
  logoUrl,
  onNavigate,
}: SidebarProps) {
  const { data: fiscal } = usePublicBranding();
  const hospitalName = displayHospitalName(fiscal?.hospital_name);
  const roleLabel = user.roles.length > 0 ? user.roles.join(', ') : 'Sin rol';
  const cashIsOpen = cashSession?.status === 'open';
  const cashLabel = cashIsOpen ? `Caja #${cashSession.id} abierta` : 'Sin caja abierta';
  const groupedNavigation = groupNavigation(visibleNavigation);

  return (
    <div className="flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-operational">
      <div className="border-b border-sidebar-border p-4">
        <div className="rounded-panel border border-sidebar-border bg-sidebar-accent/70 p-3">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo institucional"
                width={40}
                height={40}
                className="size-11 shrink-0 rounded-md border border-sidebar-border bg-card object-contain p-1"
              />
            ) : (
              <div className="flex size-11 shrink-0 items-center justify-center rounded-md border border-sidebar-primary/30 bg-sidebar text-sidebar-primary shadow-sm">
                <ShieldCheck data-icon="inline-start" aria-hidden="true" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/80">
                Sistema hospitalario local
              </p>
              <p className="truncate text-base font-semibold leading-tight text-sidebar-foreground" title={hospitalName}>
                {hospitalName}
              </p>
            </div>
          </div>
        </div>
        <div
          data-slot="sidebar-cash-status"
          className={[
            'mt-3 flex items-center gap-3 rounded-panel border px-3 py-3 text-sm font-semibold',
            cashIsOpen
              ? 'border-sidebar-primary/50 bg-sidebar-primary/10 text-sidebar-foreground'
              : 'border-warning/45 bg-warning/10 text-sidebar-foreground',
          ].join(' ')}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-sidebar-border bg-sidebar text-sidebar-primary">
            <CircleDollarSign data-icon className="size-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/72">
              Estado de caja
            </span>
            <span className="block truncate">{cashLabel}</span>
          </span>
        </div>
      </div>

      <nav aria-label="Navegación principal" className="min-h-0 flex-1">
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-5 px-3 py-4">
            {groupedNavigation.length > 0 ? (
              groupedNavigation.map((section) => (
                <SidebarSection
                  key={section.group}
                  label={section.label}
                  sectionId={`sidebar-section-${section.group}`}
                  activeItem={activeItem}
                  items={section.items}
                  onNavigate={onNavigate}
                />
              ))
            ) : (
              <p className="rounded-md border border-sidebar-border bg-sidebar-accent px-3 py-2 text-xs text-sidebar-foreground/70">
                No hay módulos de navegación disponibles.
              </p>
            )}
          </div>
        </ScrollArea>
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 rounded-panel border border-sidebar-border bg-sidebar-accent/80 p-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-sidebar-border bg-sidebar text-sidebar-foreground/70">
            <User data-icon="inline-start" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight text-sidebar-foreground">{user.name}</p>
            <p className="truncate text-xs text-sidebar-foreground/78">{roleLabel}</p>
          </div>
        </div>
        <Separator className="my-3 bg-sidebar-border" />
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/80">
          <Network data-icon className="size-3.5 text-sidebar-primary" aria-hidden="true" />
          <span>Operacion LAN</span>
        </div>
      </div>
    </div>
  );
}

function groupNavigation(items: AppNavigationItem[]) {
  const groups = [
    { group: 'operations', label: 'Operación' },
    { group: 'administration', label: 'Administración' },
    { group: 'support', label: 'Soporte' },
  ] as const;

  return groups
    .map((group) => ({
      ...group,
      items: items.filter((item) => (item.navigationGroup ?? 'operations') === group.group),
    }))
    .filter((group) => group.items.length > 0);
}
