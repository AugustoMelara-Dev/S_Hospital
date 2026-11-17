import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/api/queryClient';
import type { Settings } from '@/api/types';
import { usePermissions } from '@/auth/hooks';
import { Card, Skeleton, Switch, toast } from '@/ui';
import { useSettings } from './IdentidadTab';

export function ReglasTab() {
  const { can } = usePermissions();
  const qc = useQueryClient();
  const q = useSettings();
  const mut = useMutation({
    mutationFn: (enabled: boolean) => api.put<Settings>('/settings', { partial_payments_enabled: enabled }),
    onMutate: (enabled) => {
      const prev = qc.getQueryData<Settings>(qk.settings);
      if (prev) qc.setQueryData(qk.settings, { ...prev, partial_payments_enabled: enabled });
      return { prev };
    },
    onSuccess: (data, enabled) => {
      if (data) qc.setQueryData(qk.settings, data);
      toast.success(enabled ? 'Abonos parciales permitidos.' : 'Abonos parciales desactivados.');
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.settings, ctx.prev);
      toast.error(errorMessage(e));
    },
  });

  return (
    <Card title="Reglas de cobro" className="max-w-[720px]">
      {q.isLoading || !q.data ? (
        <Skeleton lines={2} />
      ) : (
        <Switch
          label="Permitir abonos parciales"
          description="Permite registrar cobros menores al saldo. La factura queda en «Pago parcial» hasta completar el total."
          checked={q.data.partial_payments_enabled}
          disabled={!can('settings.update') || mut.isPending}
          onCheckedChange={(v) => mut.mutate(v)}
        />
      )}
    </Card>
  );
}
