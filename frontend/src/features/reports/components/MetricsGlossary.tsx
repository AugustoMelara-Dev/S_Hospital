import { BookOpen, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Dialog } from '@/components/ui/dialog';

type MetricsGlossaryProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  compact?: boolean;
};

const DEFINITIONS: Array<{ term: string; definition: string }> = [
  {
    term: 'Facturado',
    definition:
      'Total de facturas emitidas en el periodo, excluyendo anuladas. Es la base para entender la operacion, no el ingreso.',
  },
  {
    term: 'Cobrado',
    definition:
      'Total de pagos registrados y no anulados, en facturas no anuladas. Es lo que efectivamente entro a caja.',
  },
  {
    term: 'Pendiente',
    definition:
      'Saldo abierto de facturas emitidas o parciales. Antiguidades mayores a 30 dias requieren gestion.',
  },
  {
    term: 'Anulado',
    definition:
      'Facturas marcadas como anuladas. NO forma parte del ingreso neto. Se reporta por separado para trazabilidad.',
  },
  {
    term: 'Reversado',
    definition:
      'Pagos revertidos con auditoria. NO forma parte del ingreso neto. Implica movimiento compensatorio en caja.',
  },
  {
    term: 'Efectivo esperado',
    definition:
      'Efectivo inicial del cajero mas pagos en efectivo registrados en la sesion. Es la base para calcular diferencia.',
  },
  {
    term: 'Efectivo contado',
    definition:
      'Efectivo fisico reportado por el cajero al cierre. Se compara contra el esperado para obtener la diferencia.',
  },
  {
    term: 'Diferencia',
    definition:
      'Contado menos esperado. Positivo = sobrante. Negativo = faltante. Toda diferencia requiere nota de cierre justificada.',
  },
  {
    term: 'Ticket promedio',
    definition: 'Total facturado dividido por numero de facturas. Indicador operativo, no ingreso.',
  },
  {
    term: 'Factura parcial',
    definition:
      'Factura con pagos parciales que mantiene saldo pendiente. Mientras este abierta puede recibir pagos adicionales.',
  },
  {
    term: 'Reimpresion',
    definition:
      'Nueva emision de un comprobante ya emitido. Se audita con motivo. No crea factura ni pago nuevo.',
  },
  {
    term: 'Ingreso neto',
    definition:
      'Facturado menos anulado y reversado. Es la cifra que refleja la operacion real del periodo.',
  },
];

export function MetricsGlossary({ open, onOpenChange, compact = false }: MetricsGlossaryProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? Boolean(open) : internalOpen;
  const handleOpenChange = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const body = (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Definicion de metricas</CardTitle>
            <p className="text-xs text-muted-foreground">
              Glosario contable no negociable. Los terminos se interpretan igual en pantalla, PDF y Excel.
            </p>
          </div>
          {compact ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handleOpenChange(false)}
              aria-label="Cerrar glosario"
            >
              <X aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-48">Termino</TableHead>
              <TableHead>Definicion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {DEFINITIONS.map((entry) => (
              <TableRow key={entry.term}>
                <TableCell className="font-semibold text-foreground">{entry.term}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{entry.definition}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  if (compact) {
    return (
      <>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => handleOpenChange(true)}
          className="gap-2"
        >
          <BookOpen className="size-4" aria-hidden="true" />
          Definicion de metricas
        </Button>
        <Dialog
          open={isOpen}
          onOpenChange={handleOpenChange}
          size="xl"
          title="Definicion de metricas"
          description="Terminos contables y operativos usados en este reporte."
        >
          {body}
        </Dialog>
      </>
    );
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={handleOpenChange}
      size="xl"
      title="Definicion de metricas"
      description="Terminos contables y operativos usados en este reporte."
    >
      {body}
    </Dialog>
  );
}
