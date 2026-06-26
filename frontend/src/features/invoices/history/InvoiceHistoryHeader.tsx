import { FileText } from 'lucide-react';
import { PageHeader } from '../../../components/ui/page-header';
import type { PaginatedMeta } from '../../../lib/api';

type InvoiceHistoryHeaderProps = {
  loading: boolean;
  meta: PaginatedMeta;
};

export function InvoiceHistoryHeader({ loading, meta }: InvoiceHistoryHeaderProps) {
  const total = meta.total ?? 0;

  return (
    <PageHeader
      title="Historial de facturas"
      description="Consulte facturas recientes, reimprima recibos y gestione anulaciones autorizadas."
      secondary={(
        <div className="inline-flex items-center gap-2 rounded border border-border bg-card px-3 py-2 text-sm text-muted-foreground shadow-sm" role="status" aria-live="polite">
          <FileText data-icon aria-hidden="true" className="size-4 text-secondary" />
          <span>
          {loading
            ? 'Actualizando listado de facturas.'
            : `${total} registro${total !== 1 ? 's' : ''} en total`}
          </span>
        </div>
      )}
    />
  );
}
