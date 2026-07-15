import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Spin } from 'antd';
import { institutionalReceipts } from '@/lib/api/institutionalReceipts';
import { userSafeErrorMessage } from '@/lib/api';

type InstitutionalReceiptPreviewFrameProps = {
  receiptId: number;
  receiptNumber: string;
};

export function InstitutionalReceiptPreviewFrame({
  receiptId,
  receiptNumber,
}: InstitutionalReceiptPreviewFrameProps) {
  const preview = useQuery({
    queryKey: ['institutional-receipts', receiptId, 'html-preview'],
    queryFn: () => institutionalReceipts.previewHtml(receiptId),
    staleTime: 60_000,
  });

  if (preview.isLoading) {
    return (
      <div className="flex min-h-48 items-center justify-center" role="status" aria-label="Preparando vista previa del recibo">
        <Spin description="Preparando vista previa del recibo…" />
      </div>
    );
  }

  if (preview.isError || !preview.data) {
    return (
      <Alert
        type="error"
        showIcon
        title="No se pudo preparar la vista previa"
        description={userSafeErrorMessage(preview.error, 'Revise el servidor local y vuelva a intentar.')}
        action={<Button htmlType="button" onClick={() => void preview.refetch()}>Reintentar</Button>}
      />
    );
  }

  return (
    <iframe
      title={`Vista previa del recibo institucional ${receiptNumber}`}
      srcDoc={preview.data}
      sandbox=""
      className="institutional-receipt-preview-frame w-full border border-operational-border"
    />
  );
}
