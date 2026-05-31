import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/states';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { apiClient, type AreaPaidService, userSafeErrorMessage } from '../../lib/api';

type AreaPaidServicesViewProps = {
  onStatus: (message: string) => void;
};

export function AreaPaidServicesView({ onStatus }: AreaPaidServicesViewProps) {
  const [items, setItems] = useState<AreaPaidService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    setLoading(true);
    apiClient
      .getAreaPaidServices()
      .then((paidServices) => {
        if (!mounted) return;
        setItems(paidServices);
        setError(null);
        onStatus('Servicios pagados actualizados.');
      })
      .catch((requestError) => {
        if (!mounted) return;
        const message = userSafeErrorMessage(requestError, 'No se pudieron cargar los servicios pagados.');
        setError(message);
        onStatus(message);
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [onStatus]);

  const summary = useMemo(() => {
    return items.reduce(
      (totals, item) => ({
        count: totals.count + 1,
        amount: totals.amount + Number(item.line_total ?? 0),
      }),
      { count: 0, amount: 0 },
    );
  }, [items]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Servicios pagados"
        description="Servicios ya cobrados que pertenecen al area asignada."
      />

      {loading ? (
        <LoadingState label="Cargando servicios pagados..." />
      ) : error ? (
        <ErrorState title="No se pudo cargar la lista" description={error} />
      ) : items.length === 0 ? (
        <EmptyState
          title="Sin servicios pagados"
          description="Todavia no hay servicios cobrados para esta area."
        />
      ) : (
        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <CardTitle>Atenciones por entregar</CardTitle>
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">{summary.count} servicios</Badge>
              <Badge variant="success">L. {summary.amount.toFixed(2)}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Factura</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.invoice_number}</TableCell>
                    <TableCell>{item.patient_name}</TableCell>
                    <TableCell>{item.service_name}</TableCell>
                    <TableCell>{item.service_area_name ?? 'Area asignada'}</TableCell>
                    <TableCell>{formatDate(item.paid_at ?? item.issued_at)}</TableCell>
                    <TableCell>
                      <Badge variant={item.payment_status === 'paid' ? 'success' : 'warning'}>
                        {item.payment_status === 'paid' ? 'Pagada' : 'Parcial'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{Number(item.quantity ?? 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right">L. {Number(item.line_total ?? 0).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatDate(value: string | null): string {
  if (!value) {
    return 'Sin fecha';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('es-HN', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}
