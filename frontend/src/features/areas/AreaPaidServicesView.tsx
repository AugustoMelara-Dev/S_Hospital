import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { PageHeader } from '../../components/ui/page-header';
import { PaginationControls } from '../../components/ui/pagination';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/states';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import {
  type AreaPaidServicesReport,
  type AuthUser,
  type Payment,
  apiClient,
  userSafeErrorMessage,
} from '../../lib/api';

type AreaPaidServicesViewProps = {
  user: AuthUser;
  onStatus: (message: string) => void;
};

const today = localDateString(new Date());
const pageSize = 15;

export function AreaPaidServicesView({ user, onStatus }: AreaPaidServicesViewProps) {
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [page, setPage] = useState(1);
  const [report, setReport] = useState<AreaPaidServicesReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const areaId = user.area_id ?? user.area?.id ?? null;
  const areaName = user.area?.name ?? report?.area ?? 'Area asignada';
  const validationError = useMemo(() => validateRange(dateFrom, dateTo), [dateFrom, dateTo]);

  const loadReport = useCallback(async (targetPage = page) => {
    if (!areaId) {
      setReport(null);
      setError('');
      return;
    }

    const rangeError = validateRange(dateFrom, dateTo);
    if (rangeError) {
      setError(rangeError);
      onStatus(rangeError);
      return;
    }

    setLoading(true);
    setError('');
    onStatus('Consultando servicios pagados del area...');

    try {
      const nextReport = await apiClient.getAreaPaidServicesReport(areaId, {
        date_from: dateFrom,
        date_to: dateTo,
        page: targetPage,
        per_page: pageSize,
      });
      setReport(nextReport);
      setPage(targetPage);
      onStatus('Servicios pagados cargados.');
    } catch (nextError) {
      const message = userSafeErrorMessage(nextError, 'No se pudieron cargar los servicios pagados del area.');
      setError(message);
      onStatus(message);
    } finally {
      setLoading(false);
    }
  }, [areaId, dateFrom, dateTo, onStatus, page]);

  useEffect(() => {
    void loadReport(1);
    // Initial load should happen when the assigned area becomes known.
    // Date changes are applied by the operator with the Buscar button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaId]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadReport(1);
  }

  if (!areaId) {
    return (
      <section aria-labelledby="area-paid-services-title">
        <PageHeader
          title="Servicios pagados"
          description="Consulta de servicios cobrados para el area asignada."
        />
        <EmptyState
          title="Area no asignada"
          description="Este usuario tiene permiso de consulta, pero todavia no tiene un area asignada. Pida al administrador que actualice el usuario."
        />
      </section>
    );
  }

  const services = report?.services ?? [];
  const meta = report?.meta
    ? {
        current_page: report.meta.page,
        per_page: report.meta.per_page,
        total: report.meta.total,
      }
    : { current_page: page, per_page: pageSize, total: 0 };

  return (
    <section aria-labelledby="area-paid-services-title" className="space-y-5">
      <PageHeader
        title="Servicios pagados"
        description={`Consulta operativa de ${areaName}. Solo muestra servicios con pago registrado.`}
      />

      <Card>
        <CardHeader>
          <CardTitle id="area-paid-services-title">Consulta del area</CardTitle>
          <CardDescription>
            Use un rango corto para confirmar atenciones pagadas durante la jornada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-[1fr_1fr_auto]" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="area-paid-date-from">Desde</Label>
              <Input
                id="area-paid-date-from"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="area-paid-date-to">Hasta</Label>
              <Input
                id="area-paid-date-to"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={loading || Boolean(validationError)} className="w-full md:w-auto">
                <Search data-icon="inline-start" aria-hidden="true" />
                Buscar
              </Button>
            </div>
          </form>
          {validationError ? (
            <div className="mt-4">
              <Alert variant="destructive" title="Revise el rango">
                {validationError}
              </Alert>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {error ? (
        <ErrorState title="No se pudo cargar la consulta" description={error} />
      ) : loading && !report ? (
        <LoadingState label="Cargando servicios pagados..." />
      ) : services.length === 0 ? (
        <EmptyState
          title="Sin servicios pagados"
          description="No hay servicios pagados para esta area en el rango seleccionado."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Servicios encontrados</CardTitle>
            <CardDescription>
              {meta.total} servicio{meta.total === 1 ? '' : 's'} pagado{meta.total === 1 ? '' : 's'} entre {dateFrom} y {dateTo}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Factura</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Pagado</TableHead>
                  <TableHead>Metodo</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => (
                  <TableRow key={`${service.invoice_number}-${service.service_name}-${service.paid_at}`}>
                    <TableCell className="font-medium">{service.invoice_number}</TableCell>
                    <TableCell>{service.patient_name}</TableCell>
                    <TableCell>{service.service_name}</TableCell>
                    <TableCell>{service.category_name}</TableCell>
                    <TableCell>{dateTimeLabel(service.paid_at)}</TableCell>
                    <TableCell>{service.payment_methods.map(paymentMethodLabel).join(', ')}</TableCell>
                    <TableCell className="text-right">{service.quantity}</TableCell>
                    <TableCell className="text-right font-medium">{moneyLabel(service.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationControls
              loading={loading}
              meta={meta}
              onPageChange={(nextPage) => {
                void loadReport(nextPage);
              }}
            />
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function validateRange(dateFrom: string, dateTo: string): string {
  if (!dateFrom || !dateTo) {
    return 'Seleccione fecha de inicio y fecha final.';
  }

  const start = new Date(`${dateFrom}T00:00:00`);
  const end = new Date(`${dateTo}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Seleccione fechas validas.';
  }

  const diffDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (diffDays < 1) {
    return 'La fecha de inicio debe ser anterior o igual a la fecha final.';
  }
  if (diffDays > 31) {
    return 'El rango maximo permitido es de 31 dias.';
  }

  return '';
}

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateTimeLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('es-HN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function moneyLabel(value: string | number | null | undefined): string {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) {
    return 'L. 0.00';
  }

  return `L. ${numeric.toFixed(2)}`;
}

function paymentMethodLabel(method: Payment['method']): string {
  const labels: Record<Payment['method'], string> = {
    cash: 'Efectivo',
    card: 'Tarjeta',
    transfer: 'Transferencia',
    other: 'Otro',
  };

  return labels[method] ?? method;
}
