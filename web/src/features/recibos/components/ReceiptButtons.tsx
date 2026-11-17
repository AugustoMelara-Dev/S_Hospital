import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Printer } from 'lucide-react';
import { errorMessage } from '@/lib/api';
import type { Receipt } from '@/api/types';
import { Button, toast, type ButtonSize } from '@/ui';
import { openReceiptPdf, saveReceiptPdf } from '../api';

type Props = {
  receipt: Pick<Receipt, 'id' | 'number_full'>;
  size?: ButtonSize;
  primary?: boolean;
  showSave?: boolean;
};

/** "Imprimir recibo" (PDF in a new tab) and "Guardar PDF". */
export function ReceiptButtons({ receipt, size = 'md', primary = false, showSave = true }: Props) {
  const [busy, setBusy] = useState<'print' | 'save' | null>(null);
  const qc = useQueryClient();

  async function run(kind: 'print' | 'save') {
    setBusy(kind);
    try {
      await (kind === 'print' ? openReceiptPdf(receipt.id) : saveReceiptPdf(receipt));
      // The first print is recorded server-side (later copies are consultation copies).
      void qc.invalidateQueries({ queryKey: ['receipts', 'detail', receipt.id] });
    } catch (e) {
      toast.error({ title: 'No se pudo obtener el recibo.', description: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Button
        size={size}
        variant={primary ? 'primary' : 'secondary'}
        leftIcon={<Printer />}
        loading={busy === 'print'}
        onClick={() => void run('print')}
      >
        Imprimir recibo
      </Button>
      {showSave && (
        <Button size={size} leftIcon={<Download />} loading={busy === 'save'} onClick={() => void run('save')}>
          Guardar PDF
        </Button>
      )}
    </>
  );
}
