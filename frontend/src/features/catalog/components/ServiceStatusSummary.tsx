import { Plus } from 'lucide-react';
import { ActionBar } from '../../../components/ui/action-bar';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { PageHeader } from '../../../components/ui/page-header';
import type { ServiceStatusSummaryProps } from './catalogTypes';

export function ServiceStatusSummary({
  canManage,
  onNewCategory,
  onNewService,
  summary,
}: ServiceStatusSummaryProps) {
  const totalLabel = `${summary.total} servicio${summary.total !== 1 ? 's' : ''} en el catálogo`;

  return (
    <PageHeader
      title="Catálogo de servicios"
      description={
        canManage
          ? 'Administre categorías, servicios y precios para mantener operativo el catálogo de caja.'
          : 'Cajero puede consultar catálogo y precios, sin permisos para modificar servicios.'
      }
      topContent={
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary">
          Catálogo operativo
        </p>
      }
      secondary={
        <p
          className="font-mono text-sm tabular-nums text-muted-foreground"
          aria-label="Resumen de servicios en el catálogo"
        >
          {totalLabel}
        </p>
      }
      actions={
        canManage ? (
          <ActionBar align="end" fullWidthOnMobile>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onNewCategory}
              aria-label="Crear nueva categoría"
            >
              <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
              Nueva categoría
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onNewService}
              aria-label="Crear nuevo servicio"
            >
              <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
              Nuevo servicio
            </Button>
          </ActionBar>
        ) : (
          <Alert
            variant="default"
            title="Solo lectura"
            icon={null}
            className="border-secondary/20 bg-secondary/5 text-secondary-foreground"
          >
            Esta cuenta puede consultar el catálogo, pero no modificar servicios ni categorías.
          </Alert>
        )
      }
    />
  );
}
