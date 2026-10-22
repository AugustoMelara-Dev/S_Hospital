import { useState } from 'react';
import { formatDate, formatDateTime } from '@/lib/format/formatDate';
import { parseQuantityUnits } from '@/lib/moneyCents';
import {
  FreeMedicationBadge,
  AdminChip,
  AdminPanel,
  AdminPanelHeader,
  AdminTable,
  AdminTabs,
  MoneyText,
  QuantityText,
  StatusStamp,
  type AdminColumn,
} from '@/design-system/admin/components';
import { FREE_LINE_BADGE_CLASS, GHOST_BUTTON } from '../reportesUi';
import { formatCajaLabel, reporteCents, reporteStatusTone } from '../formato';
import type {
  ReporteCaja,
  ReporteCobro,
  ReporteDetalleLinea,
  ReporteEjecutivo,
  ReporteGratuidad,
  ReporteOperacion,
} from '../types';

const PREVIEW_ROWS = 8;

type SeccionProps<T> = {
  id: string;
  title: string;
  description: string;
  columns: AdminColumn<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  empty: string;
  /**
   * Ancho mínimo de la tabla para que las columnas no se compriman hasta partir
   * texto o recortar cifras; por debajo, el contenedor desplaza en horizontal.
   */
  minTableWidth?: string;
};

/**
 * Sección de desglose: encabezado compacto con propósito y conteo, y la tabla
 * del propósito. Las cinco secciones comparten el cuerpo del informe y se
 * separan por divisores, sin repetir una tarjeta flotante por tabla.
 */
function ReporteDesgloseSeccion<T>({
  id,
  title,
  description,
  columns,
  rows,
  getRowKey,
  empty,
  minTableWidth,
}: SeccionProps<T>) {
  const [expanded, setExpanded] = useState(false);
  const visibleRows = expanded ? rows : rows.slice(0, PREVIEW_ROWS);

  return (
    <section aria-labelledby={`${id}-title`} data-report-table={id} className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-4 pt-3.5 pb-2.5">
        <div className="min-w-0">
          <h3
            id={`${id}-title`}
            className="text-[length:var(--ui-text-md)] font-semibold leading-tight text-[color:var(--ui-ink)]"
          >
            {title}
          </h3>
          <p className="mt-0.5 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
            {description}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <AdminChip>{rows.length === 1 ? '1 fila' : `${rows.length} filas`}</AdminChip>
          {rows.length > PREVIEW_ROWS ? (
            <button
              type="button"
              data-ui-press
              aria-expanded={expanded}
              className={GHOST_BUTTON}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? 'Ver menos' : `Ver todas (${rows.length})`}
            </button>
          ) : null}
        </div>
      </div>
      <div className="px-4 pb-3.5">
        <AdminTable
          columns={columns}
          rows={visibleRows}
          getRowKey={getRowKey}
          caption={title}
          minTableWidth={minTableWidth}
          empty={empty}
        />
        {!expanded && rows.length > PREVIEW_ROWS ? (
          <p className="mt-2 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
            Mostrando {PREVIEW_ROWS} de {rows.length}.
          </p>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Cuerpo de desglose del informe.
 *
 * V07: antes las cinco tablas se apilaban una tras otra; a 1366 px eso obligaba a
 * recorrer cinco tablas anchas y a desplazarse en horizontal en cada una, con la
 * sensación de «columnas finales recortadas» y dinero partido. Ahora hay **un
 * desglose activo a la vez**, elegido con pestañas que declaran su conteo.
 *
 * El **export no depende de la pestaña visible**: los exportadores reciben el
 * `report` completo, no lo que está en pantalla. Cambiar de pestaña no filtra ni
 * recorta la descarga.
 */
export function ReporteDesglose({ report }: { report: ReporteEjecutivo }) {
  const [active, setActive] = useState('operaciones');

  const items = [
    { id: 'operaciones', label: `Operaciones (${report.operations.length})` },
    { id: 'detalle', label: `Detalle (${report.detail.length})` },
    { id: 'cobros', label: `Cobros (${report.collections.length})` },
    { id: 'caja', label: `Caja (${report.cash_sessions.length})` },
    { id: 'gratuidades', label: `Gratuidades (${report.gratuities.length})` },
  ];

  return (
    <AdminPanel as="section" aria-labelledby="reportes-desglose-title">
      <AdminPanelHeader
        headingLevel={2}
        id="reportes-desglose-title"
        title="Desglose"
        description="Elija un desglose. La exportación incluye siempre el conjunto completo."
      />
      <div className="px-4 py-3">
        <AdminTabs
          ariaLabel="Desglose del reporte"
          items={items}
          value={active}
          onValueChange={setActive}
        >
          {active === 'operaciones' ? <ReporteOperacionesTabla rows={report.operations} /> : null}
          {active === 'detalle' ? <ReporteDetalleTabla rows={report.detail} /> : null}
          {active === 'cobros' ? <ReporteCobrosTabla rows={report.collections} /> : null}
          {active === 'caja' ? <ReporteCajaTabla rows={report.cash_sessions} /> : null}
          {active === 'gratuidades' ? <ReporteGratuidadesTabla rows={report.gratuities} /> : null}
        </AdminTabs>
      </div>
    </AdminPanel>
  );
}

export function ReporteOperacionesTabla({ rows }: { rows: ReporteOperacion[] }) {
  const columns: AdminColumn<ReporteOperacion>[] = [
    { key: 'fecha', header: 'Fecha', cell: (row) => formatDate(row.date) },
    { key: 'numero', header: 'N.º factura', mobilePrimary: true, cell: (row) => <span className="tabular-nums">{row.invoice_number}</span> },
    { key: 'paciente', header: 'Paciente', cell: (row) => row.patient },
    { key: 'caja', header: 'Caja / sesión', cell: (row) => row.cash_session_label ?? '—' },
    { key: 'cajero', header: 'Cajero', cell: (row) => row.cashier ?? '—' },
    { key: 'total', header: 'Total', align: 'right', mobilePrimary: true, cell: (row) => <MoneyText cents={reporteCents(row.total)} /> },
    { key: 'pagado', header: 'Pagado', align: 'right', cell: (row) => <MoneyText cents={reporteCents(row.paid)} /> },
    { key: 'saldo', header: 'Saldo', align: 'right', cell: (row) => <MoneyText cents={reporteCents(row.balance)} /> },
    {
      key: 'estado',
      header: 'Estado',
      cell: (row) => {
        const tone = reporteStatusTone(row.status_label);
        return <StatusStamp status={tone.status} label={tone.label} />;
      },
    },
    { key: 'documento', header: 'Documento', mobileHidden: true, cell: (row) => row.receipt_document ?? '—' },
  ];

  return (
    <ReporteDesgloseSeccion
      id="operaciones"
      title="Operaciones"
      description="Emisión: fecha, número, paciente, caja/sesión, total, pagado, saldo y estado."
      columns={columns}
      rows={rows}
      getRowKey={(row, index) => `${row.invoice_number}-${index}`}
      minTableWidth="58rem"
      empty="Sin operaciones emitidas en el rango."
    />
  );
}

export function ReporteDetalleTabla({ rows }: { rows: ReporteDetalleLinea[] }) {
  const columns: AdminColumn<ReporteDetalleLinea>[] = [
    { key: 'fecha', header: 'Fecha', cell: (row) => formatDate(row.date) },
    { key: 'numero', header: 'N.º factura', cell: (row) => <span className="tabular-nums">{row.invoice_number}</span> },
    { key: 'paciente', header: 'Paciente', cell: (row) => row.patient },
    { key: 'servicio', header: 'Producto / servicio', mobilePrimary: true, cell: (row) => row.service },
    { key: 'categoria', header: 'Categoría / área', cell: (row) => [row.category, row.area].filter(Boolean).join(' · ') || '—' },
    { key: 'cantidad', header: 'Cantidad', align: 'right', cell: (row) => <QuantityText units={parseQuantityUnits(row.quantity)} /> },
    { key: 'precio', header: 'Precio registrado', align: 'right', cell: (row) => <MoneyText cents={reporteCents(row.unit_price)} /> },
    { key: 'ajuste', header: 'Ajuste por regla', align: 'right', mobileHidden: true, cell: (row) => <MoneyText cents={reporteCents(row.rule_adjustment)} /> },
    { key: 'impuesto', header: 'Impuesto', align: 'right', cell: (row) => <MoneyText cents={reporteCents(row.tax)} /> },
    { key: 'total', header: 'Importe final', align: 'right', mobilePrimary: true, cell: (row) => <MoneyText cents={reporteCents(row.line_total)} /> },
    {
      key: 'gratuidad',
      header: 'Gratuidad',
      cell: (row) =>
        row.is_free ? (
          // Dark: la gratuidad usa el tinte cobalto con etiqueta textual (§2);
          // el sello de la línea sin cobro ya no hereda el gris neutro.
          <FreeMedicationBadge label={row.rule_label ?? 'Gratuidad'} className={FREE_LINE_BADGE_CLASS} />
        ) : (
          'No'
        ),
    },
  ];

  return (
    <ReporteDesgloseSeccion
      id="detalle"
      title="Detalle"
      description="Producto/servicio: cantidad, precio registrado, ajuste por regla, impuesto e importe final."
      columns={columns}
      rows={rows}
      getRowKey={(row, index) => `${row.invoice_number}-${row.service}-${index}`}
      minTableWidth="58rem"
      empty="Sin líneas de detalle en el rango."
    />
  );
}

export function ReporteCobrosTabla({ rows }: { rows: ReporteCobro[] }) {
  const columns: AdminColumn<ReporteCobro>[] = [
    { key: 'fecha', header: 'Fecha de pago', cell: (row) => formatDateTime(row.paid_at) },
    { key: 'numero', header: 'N.º factura', mobilePrimary: true, cell: (row) => <span className="tabular-nums">{row.invoice_number}</span> },
    { key: 'paciente', header: 'Paciente', cell: (row) => row.patient },
    { key: 'caja', header: 'Caja / sesión', cell: (row) => row.cash_session_label ?? '—' },
    { key: 'cajero', header: 'Cajero', cell: (row) => row.cashier ?? '—' },
    { key: 'metodo', header: 'Método', cell: (row) => row.method_label },
    { key: 'referencia', header: 'Referencia', cell: (row) => row.reference ?? '—' },
    { key: 'importe', header: 'Importe', align: 'right', mobilePrimary: true, cell: (row) => <MoneyText cents={reporteCents(row.amount)} /> },
    {
      key: 'estado',
      header: 'Estado',
      cell: (row) => {
        const tone = reporteStatusTone(row.status_label);
        return <StatusStamp status={tone.status} label={tone.label} />;
      },
    },
  ];

  return (
    <ReporteDesgloseSeccion
      id="cobros"
      title="Cobros"
      description="Fecha efectiva de pago, paciente, caja/sesión, método, referencia e importe."
      columns={columns}
      rows={rows}
      getRowKey={(row, index) => `${row.invoice_number}-${row.paid_at ?? index}`}
      minTableWidth="56rem"
      empty="Sin cobros registrados en el rango."
    />
  );
}

export function ReporteCajaTabla({ rows }: { rows: ReporteCaja[] }) {
  const columns: AdminColumn<ReporteCaja>[] = [
    { key: 'id', header: 'Sesión', cell: (row) => `#${row.id}` },
    { key: 'caja', header: 'Caja física', mobilePrimary: true, cell: (row) => formatCajaLabel(row.cash_register_name, row.cash_register_code, row.id) },
    { key: 'cajero', header: 'Responsable', cell: (row) => row.cashier },
    { key: 'apertura', header: 'Apertura', cell: (row) => formatDateTime(row.opened_at) },
    { key: 'cierre', header: 'Cierre', cell: (row) => (row.closed_at ? formatDateTime(row.closed_at) : '—') },
    { key: 'inicial', header: 'Inicial', align: 'right', mobileHidden: true, cell: (row) => <MoneyText cents={reporteCents(row.opening_amount)} /> },
    { key: 'esperado', header: 'Esperado', align: 'right', cell: (row) => <MoneyText cents={reporteCents(row.expected_cash)} /> },
    { key: 'contado', header: 'Contado', align: 'right', cell: (row) => <MoneyText cents={reporteCents(row.counted_cash)} fallback="—" /> },
    { key: 'diferencia', header: 'Diferencia', align: 'right', mobilePrimary: true, cell: (row) => <MoneyText cents={reporteCents(row.difference)} fallback="—" /> },
    {
      key: 'estado',
      header: 'Estado',
      cell: (row) => {
        const tone = reporteStatusTone(row.status_label ?? row.status);
        return <StatusStamp status={tone.status} label={tone.label} />;
      },
    },
    { key: 'nota', header: 'Motivo / nota', cell: (row) => row.closure_note ?? '—' },
  ];

  return (
    <ReporteDesgloseSeccion
      id="caja"
      title="Caja"
      description="Apertura y cierre, responsable, esperado/contado/diferencia y motivo registrado."
      columns={columns}
      rows={rows}
      getRowKey={(row) => `caja-${row.id}`}
      minTableWidth="58rem"
      empty="Sin sesiones de caja en el rango."
    />
  );
}

export function ReporteGratuidadesTabla({ rows }: { rows: ReporteGratuidad[] }) {
  const columns: AdminColumn<ReporteGratuidad>[] = [
    { key: 'fecha', header: 'Fecha', cell: (row) => formatDate(row.date) },
    { key: 'numero', header: 'N.º factura', cell: (row) => <span className="tabular-nums">{row.invoice_number}</span> },
    { key: 'paciente', header: 'Paciente', cell: (row) => row.patient },
    { key: 'servicio', header: 'Medicamento / servicio', mobilePrimary: true, cell: (row) => row.service },
    { key: 'cantidad', header: 'Cantidad entregada', align: 'right', cell: (row) => <QuantityText units={parseQuantityUnits(row.quantity)} /> },
    { key: 'ajuste', header: 'Valor del ajuste', align: 'right', mobilePrimary: true, cell: (row) => <MoneyText cents={reporteCents(row.adjustment_value)} /> },
    { key: 'motivo', header: 'Motivo', cell: (row) => row.reason },
  ];

  return (
    <ReporteDesgloseSeccion
      id="gratuidades"
      title="Gratuidades"
      description="Unidades entregadas sin cobro por regla; no se confunden con unidades cobradas."
      columns={columns}
      rows={rows}
      getRowKey={(row, index) => `${row.invoice_number}-${row.service}-${index}`}
      minTableWidth="52rem"
      empty="Sin líneas gratuitas en el rango."
    />
  );
}
