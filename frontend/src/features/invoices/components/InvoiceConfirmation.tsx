import { DollarOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { Alert, Button, Descriptions, Modal, Space, Typography } from 'antd';
import { type KeyboardEvent, useEffect, useRef } from 'react';
import { formatLempirasUIFromCents, parseCents } from '../../../lib/moneyCents';

type CartItem = { service: import('../../../lib/api').Service; quantity: string; dialysisPrescription: boolean };
type Props = { open: boolean; onOpenChange: (open: boolean) => void; patientName: string; items: CartItem[]; preview: { subtotal: string; tax: string; total: string }; taxRate?: string; cashSessionId?: number; canOpenPayment?: boolean; onConfirm: () => void; submitting?: boolean };

export function InvoiceConfirmation({ open, onOpenChange, patientName, items, preview, taxRate, cashSessionId, canOpenPayment = true, onConfirm, submitting }: Props) {
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialysisPrescription = items.some(
    (item) => item.dialysisPrescription && item.service.special_rule_code === 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
  );
  const willOpenPayment = canOpenPayment && Boolean(cashSessionId) && (parseCents(preview.total) ?? 0) > 0;
  const title = willOpenPayment ? 'Confirmar emisión y cobro' : 'Confirmar factura';
  useEffect(() => { if (open) window.setTimeout(() => confirmButtonRef.current?.focus(), 0); }, [open]);
  function handleShortcut(event: KeyboardEvent<HTMLButtonElement>) { if (event.ctrlKey && event.key === 'Enter' && !submitting) { event.preventDefault(); onConfirm(); } }

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title={title}
      footer={null}
      destroyOnHidden
    >
      <Space orientation="vertical" size="middle" className="w-full">
        <Typography.Paragraph>{willOpenPayment ? 'Se emitirá la factura y el sistema abrirá el cobro inmediatamente.' : 'Revise los detalles antes de emitir la factura.'}</Typography.Paragraph>
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="Paciente">{patientName || 'Sin nombre'}</Descriptions.Item>
          <Descriptions.Item label="Caja">#{cashSessionId ?? 'Sin caja'}</Descriptions.Item>
        </Descriptions>
        <section aria-labelledby="confirmation-services-title">
          <Typography.Text id="confirmation-services-title" strong>Servicios</Typography.Text>
          <ul aria-label="Servicios por confirmar" className="mt-2 divide-y divide-border border-y border-border">
            {items.map((item, index) => (
              <li key={`${item.service.id}-${index}`} className="flex items-center justify-between gap-4 py-3">
                <span>{item.quantity} x {item.service.name}</span>
                <span>{dialysisPrescription && item.service.special_rule_code === 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION' ? 'GRATIS' : moneyLabel(item.service.price)}</span>
              </li>
            ))}
          </ul>
        </section>
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="Subtotal">{moneyLabel(preview.subtotal)}</Descriptions.Item>
          {taxRate ? <Descriptions.Item label={`ISV (${taxRate}%)`}>{moneyLabel(preview.tax)}</Descriptions.Item> : null}
          <Descriptions.Item label={<Space><DollarOutlined />Total estimado</Space>}><Typography.Text strong>{moneyLabel(preview.total)}</Typography.Text></Descriptions.Item>
        </Descriptions>
        <Alert type="warning" showIcon icon={<ExclamationCircleOutlined />} title="El total definitivo quedará confirmado al emitir la factura." />
        <Space className="w-full" orientation="vertical">
          <Button block onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button block ref={confirmButtonRef} type="primary" onKeyDown={handleShortcut} onClick={onConfirm} loading={submitting} disabled={submitting}>{willOpenPayment ? 'Emitir y abrir cobro' : 'Confirmar emisión'}</Button>
        </Space>
      </Space>
    </Modal>
  );
}

function moneyLabel(value: string | number | null | undefined) { return formatLempirasUIFromCents(parseCents(value)); }
