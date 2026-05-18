import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { FiscalSettings, FiscalSequence } from '@/lib/api';

const settingsFormSchema = z.object({
  hospital_name: z.string().min(1, 'El nombre del hospital es requerido'),
  rtn: z.string(),
  receipt_width: z.enum(['80mm', '58mm']),
});

type SettingsFormData = z.infer<typeof settingsFormSchema>;

const sequenceFormSchema = z.object({
  prefix: z.string().min(1, 'El prefijo es requerido').max(5, 'Prefijo muy largo'),
  cai: z.string().min(1, 'El CAI es requerido'),
  min_number: z.number().int().min(1, 'Debe ser mayor a 0'),
  max_number: z.number().int().min(1, 'Debe ser mayor a 0'),
  valid_until: z.string(),
});

type SequenceFormData = z.infer<typeof sequenceFormSchema>;

export type { SettingsFormData, SequenceFormData };

interface FiscalSettingsFormProps {
  settings: FiscalSettings | null;
  sequence: FiscalSequence | null;
  canEdit: boolean;
  onSaveSettings: (data: SettingsFormData) => Promise<void>;
  onSaveSequence: (data: SequenceFormData) => Promise<void>;
}

export function FiscalSettingsForm({
  settings,
  sequence,
  canEdit,
  onSaveSettings,
  onSaveSequence,
}: FiscalSettingsFormProps) {
  const {
    register: registerSettings,
    handleSubmit: handleSubmitSettings,
    formState: { errors: errorsSettings },
    watch: watchSettings,
    setValue: setValueSettings,
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      hospital_name: settings?.hospital_name ?? '',
      rtn: settings?.rtn ?? '',
      receipt_width: settings?.receipt_width ?? '80mm',
    },
  });

  const {
    register: registerSequence,
    handleSubmit: handleSubmitSequence,
    formState: { errors: errorsSequence },
  } = useForm<SequenceFormData>({
    resolver: zodResolver(sequenceFormSchema),
    defaultValues: {
      prefix: sequence?.prefix ?? '',
      cai: sequence?.cai ?? '',
      min_number: sequence?.min_number ?? 1,
      max_number: sequence?.max_number ?? 99999999,
      valid_until: sequence?.valid_until ?? '',
    },
  });

  const hasSequence = Boolean(sequence?.cai);

  async function handleSettingsSubmit(data: SettingsFormData) {
    await onSaveSettings(data);
  }

  async function handleSequenceSubmit(data: SequenceFormData) {
    await onSaveSequence(data);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Información del Hospital</CardTitle>
          <CardDescription>
            Estos datos aparecerán en los recibos térmicos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmitSettings(handleSettingsSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hospital_name">Nombre del Hospital *</Label>
                <Input
                  id="hospital_name"
                  {...registerSettings('hospital_name')}
                  placeholder="Hospital Nacional de..."
                />
                {errorsSettings.hospital_name && (
                  <p className="text-sm text-destructive">{errorsSettings.hospital_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="rtn">RTN</Label>
                <Input
                  id="rtn"
                  {...registerSettings('rtn')}
                  placeholder="0801-XXXX-XXXXX"
                />
              </div>
            </div>

            <div className="w-[200px]">
              <Label htmlFor="receipt_width">Ancho de Recibo</Label>
              <Select
                value={watchSettings('receipt_width')}
                onValueChange={(v: string) => setValueSettings('receipt_width', v as '80mm' | '58mm')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="80mm">80mm (Estándar)</SelectItem>
                  <SelectItem value="58mm">58mm (Angosto)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={!canEdit}>
                Guardar Información
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Secuencia Fiscal</CardTitle>
          <CardDescription>
            Configure la secuencia de facturación autorizada por la autoridad fiscal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmitSequence(handleSequenceSubmit)} className="space-y-4">
            {!hasSequence && (
              <Alert variant="warning">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Sin secuencia fiscal</AlertTitle>
                <AlertDescription>
                  No hay una secuencia fiscal configurada. Agregue una para poder emitir facturas.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prefix">Prefijo *</Label>
                <Input
                  id="prefix"
                  {...registerSequence('prefix')}
                  placeholder="A"
                  className="uppercase"
                />
                {errorsSequence.prefix && (
                  <p className="text-sm text-destructive">{errorsSequence.prefix.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="cai">CAI *</Label>
                <Input
                  id="cai"
                  {...registerSequence('cai')}
                  placeholder="CAI-XXXXX-XXXXX-XXXXX"
                />
                {errorsSequence.cai && (
                  <p className="text-sm text-destructive">{errorsSequence.cai.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="min_number">Desde el número *</Label>
                <Input
                  id="min_number"
                  type="number"
                  {...registerSequence('min_number', { valueAsNumber: true })}
                  placeholder="1"
                />
                {errorsSequence.min_number && (
                  <p className="text-sm text-destructive">{errorsSequence.min_number.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_number">Hasta el número *</Label>
                <Input
                  id="max_number"
                  type="number"
                  {...registerSequence('max_number', { valueAsNumber: true })}
                  placeholder="10000"
                />
                {errorsSequence.max_number && (
                  <p className="text-sm text-destructive">{errorsSequence.max_number.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="valid_until">Válido hasta</Label>
                <Input
                  id="valid_until"
                  type="date"
                  {...registerSequence('valid_until')}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={!canEdit}>
                Guardar Secuencia
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}