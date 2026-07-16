import { EyeOutlined, FilePdfOutlined, PrinterOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Descriptions, Modal, Result, Space } from 'antd';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { Payment } from '../../../lib/api';
import { formatLempirasUIFromCents, parseCents } from '../../../lib/moneyCents';

type InvoiceStatus = 'issued' | 'paid' | 'partial' | 'void';
type Props = { open: boolean; onOpenChange: (open: boolean) => void; invoiceNumber: string; patientName: string; total: string; status: InvoiceStatus; canCollectPayment?: boolean; canPrintReceipt?: boolean; canSavePdf?: boolean; receiptRecoveryMessage?: string; paymentMethod?: Payment['method']; paymentDate?: string; receivedAmount?: string | null; changeAmount?: string | null; onCobrar: () => void; onVerRecibo?: () => void; onImprimir: () => void; onGuardarPdf?: () => void; onNuevaFactura: () => void };
const STATUS_LABELS: Record<InvoiceStatus, string> = { issued: 'Emitida', paid: 'Pagada', partial: 'Parcial', void: 'Anulada' };
const PAYMENT_METHOD_LABELS: Record<Payment['method'], string> = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', other: 'Otro' };

export function InvoiceSuccess({ open, onOpenChange, invoiceNumber, patientName, total, status, canCollectPayment = true, canPrintReceipt = true, canSavePdf = false, receiptRecoveryMessage, paymentMethod, paymentDate, receivedAmount, changeAmount, onCobrar, onVerRecibo, onImprimir, onGuardarPdf, onNuevaFactura }: Props) {
  const needsPayment = status === 'issued' || status === 'partial';
  const canShowPaymentAction = needsPayment && canCollectPayment;
  const title = status === 'paid' ? 'Factura pagada' : needsPayment ? 'Factura pendiente' : 'Factura creada';
  const hasReceiptRecovery = Boolean(receiptRecoveryMessage?.trim());
  const description = status === 'paid'
    ? canPrintReceipt ? 'La factura ya fue pagada. Recibo listo para imprimir.' : 'La factura ya fue pagada. Solicite a caja imprimir el recibo institucional.'
    : needsPayment ? 'La factura ya fue emitida y queda pendiente de cobro para caja.' : 'Factura creada.';
  const primaryActionRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { if (open) window.setTimeout(() => primaryActionRef.current?.focus(), 0); }, [open, canShowPaymentAction]);

  const actions = needsPayment ? (
    <Space orientation="vertical" className="w-full">
      {canShowPaymentAction ? <Button block ref={primaryActionRef} type="primary" onClick={onCobrar}>Cobrar ahora</Button> : null}
      <Button block ref={canShowPaymentAction ? undefined : primaryActionRef} icon={<PlusOutlined aria-hidden="true" />} onClick={onNuevaFactura}>Nueva factura</Button>
    </Space>
  ) : canPrintReceipt ? (
    <Space orientation="vertical" className="w-full">
      {onVerRecibo ? <Button block ref={primaryActionRef} type="primary" icon={<EyeOutlined aria-hidden="true" />} onClick={onVerRecibo}>Ver recibo</Button> : null}
      <Button block ref={onVerRecibo ? undefined : primaryActionRef} icon={<PrinterOutlined aria-hidden="true" />} onClick={onImprimir}>Imprimir recibo</Button>
      {canSavePdf && onGuardarPdf ? <Button block icon={<FilePdfOutlined aria-hidden="true" />} onClick={onGuardarPdf}>Guardar PDF</Button> : null}
      <Button block icon={<PlusOutlined aria-hidden="true" />} onClick={onNuevaFactura}>Nueva factura</Button>
    </Space>
  ) : (
    <Space orientation="vertical" className="w-full">
      {hasReceiptRecovery ? <Link to={`/invoices?invoice_number=${encodeURIComponent(invoiceNumber)}`}><Button block type="primary">Resolver recibo en Historial</Button></Link> : null}
      <Button block ref={primaryActionRef} icon={<PlusOutlined aria-hidden="true" />} onClick={onNuevaFactura}>Nueva factura</Button>
    </Space>
  );

  return (
    <Modal getContainer={false} open={open} onCancel={() => onOpenChange(false)} title={title} footer={null} destroyOnHidden>
      <Result status={status === 'paid' ? 'success' : needsPayment ? 'warning' : 'success'} title={title} />
      <Descriptions bordered size="small" column={1}>
        <Descriptions.Item label="Factura">{invoiceNumber}</Descriptions.Item>
        <Descriptions.Item label="Paciente">{patientName}</Descriptions.Item>
        <Descriptions.Item label="Total">{moneyLabel(total)}</Descriptions.Item>
        <Descriptions.Item label="Estado">{STATUS_LABELS[status]}</Descriptions.Item>
        {paymentMethod ? <Descriptions.Item label="Método">{PAYMENT_METHOD_LABELS[paymentMethod]}</Descriptions.Item> : null}
        {paymentMethod === 'cash' && receivedAmount ? <Descriptions.Item label="Monto recibido">{moneyLabel(receivedAmount)}</Descriptions.Item> : null}
        {paymentMethod === 'cash' && changeAmount ? <Descriptions.Item label="Cambio">{moneyLabel(changeAmount)}</Descriptions.Item> : null}
        {formatPaymentDate(paymentDate) ? <Descriptions.Item label="Fecha de pago">{formatPaymentDate(paymentDate)}</Descriptions.Item> : null}
      </Descriptions>
      {receiptRecoveryMessage ? <Alert type="warning" showIcon title={receiptRecoveryMessage} /> : null}
      <p>{description}</p>
      {needsPayment ? <p>{canShowPaymentAction ? 'La factura ya fue emitida. El siguiente paso operativo es registrar el cobro.' : 'La factura ya fue emitida y queda pendiente de cobro para caja.'}</p> : null}
      {actions}
      {!hasReceiptRecovery || canPrintReceipt ? <Link to="/invoices"><Button block type="link">Ir al historial</Button></Link> : null}
    </Modal>
  );
}

function moneyLabel(value: string | number | null | undefined) { return formatLempirasUIFromCents(parseCents(value)); }
function formatPaymentDate(value?: string) { if (!value) return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date); }
