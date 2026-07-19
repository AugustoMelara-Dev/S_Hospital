import { useQuery } from '@tanstack/react-query';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
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
        <Spinner aria-hidden="true" /><span className="ml-2">Preparando vista previa del recibo…</span>
      </div>
    );
  }

  if (preview.isError || !preview.data) {
    return (
      <Alert variant="destructive"><AlertTitle>No se pudo preparar la vista previa</AlertTitle><AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><span>{userSafeErrorMessage(preview.error, 'Revise el servidor local y vuelva a intentar.')}</span><Button type="button" variant="outline" onClick={() => void preview.refetch()}>Reintentar</Button></AlertDescription></Alert>
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
