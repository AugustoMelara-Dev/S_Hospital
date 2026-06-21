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
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          {loading
            ? 'Actualizando listado de facturas.'
            : `${total} registro${total !== 1 ? 's' : ''} en total`}
        </p>
      )}
    />
  );
}
