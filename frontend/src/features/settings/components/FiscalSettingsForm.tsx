import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { FiscalSettings, FiscalSequence } from '@/lib/api';
import {
  INSTITUTIONAL_RECEIPT_PAPER_OPTIONS,
  INSTITUTIONAL_RECEIPT_PAPER_VALUES,
  type InstitutionalReceiptPaperOption,
  institutionalReceiptPaperSize,
} from '@/lib/institutionalReceiptPaper';

type InstitutionalReceiptPaperSize = InstitutionalReceiptPaperOption;

function institutionalPaperSize(value: FiscalSettings['receipt_paper_size']): InstitutionalReceiptPaperSize {
  return institutionalReceiptPaperSize(value);
}

export const settingsFormSchema = z.object({
  hospital_name: z.string().min(1, 'El nombre del hospital es requerido'),
  rtn: z.string().max(32, 'RTN muy largo'),
  receipt_paper_size: z.enum(INSTITUTIONAL_RECEIPT_PAPER_VALUES),
  primary_color: z.enum(['teal', 'blue', 'indigo', 'green', 'rose']),
  address: z.string().optional(),
  slogan: z.string().optional(),
});

type SettingsFormData = z.infer<typeof settingsFormSchema>;

export const sequenceFormSchema = z.object({
  prefix: z.string().min(1, 'El prefijo es requerido').max(32, 'Prefijo muy largo'),
  cai: z.string().min(1, 'El CAI es requerido').max(128, 'CAI muy largo'),
  min_number: z.number().int().min(1, 'Debe ser mayor a 0'),
  max_number: z.number().int().min(1, 'Debe ser mayor a 0'),
  valid_until: z.string().min(1, 'La fecha de vencimiento es requerida'),
}).superRefine((data, ctx) => {
  if (data.max_number < data.min_number) {
    ctx.addIssue({
      code: 'custom',
      path: ['max_number'],
      message: 'El número máximo debe ser mayor o igual al mínimo.',
    });
  }
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
      receipt_paper_size: institutionalPaperSize(settings?.receipt_paper_size),
      primary_color: settings?.primary_color ?? 'indigo',
      address: settings?.address ?? '',
      slogan: settings?.slogan ?? '',
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
          <CardTitle>Hospital y recibo</CardTitle>
          <CardDescription>
            Estos datos aparecen en recibos, facturas impresas y pantalla de ingreso.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmitSettings(handleSettingsSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hospital_name">Nombre del hospital *</Label>
                <Input
                  id="hospital_name"
                  {...registerSettings('hospital_name')}
                  placeholder="Hospital Nacional de..."
                  aria-invalid={Boolean(errorsSettings.hospital_name)}
                  aria-describedby={errorsSettings.hospital_name ? 'hospital-name-error' : undefined}
                />
                {errorsSettings.hospital_name && (
                  <p id="hospital-name-error" role="alert" className="text-sm text-destructive">{errorsSettings.hospital_name.message}</p>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="address">Dirección del hospital</Label>
                <Input
                  id="address"
                  {...registerSettings('address')}
                  placeholder="Barrio Centro, Avenida Principal..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slogan">Eslogan o Lema</Label>
                <Input
                  id="slogan"
                  {...registerSettings('slogan')}
                  placeholder="Al servicio de tu salud..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div className="w-full">
                <Label htmlFor="receipt_paper_size">Recibo institucional</Label>
                <Select
                  value={watchSettings('receipt_paper_size')}
                  onValueChange={(v: string) => setValueSettings('receipt_paper_size', v as InstitutionalReceiptPaperSize)}
                >
                  <SelectTrigger id="receipt_paper_size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INSTITUTIONAL_RECEIPT_PAPER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
                <Label>Color de marca</Label>
              <div className="flex flex-wrap gap-3">
                {([
                  { id: 'indigo', name: 'Índigo', color: 'bg-indigo-600' },
                  { id: 'blue', name: 'Azul Clínico', color: 'bg-blue-600' },
                  { id: 'teal', name: 'Turquesa', color: 'bg-teal-600' },
                  { id: 'green', name: 'Verde Médico', color: 'bg-green-600' },
                  { id: 'rose', name: 'Rosa Cálido', color: 'bg-rose-600' },
                ] as const).map((c) => (
                  <Button
                    key={c.id}
                    type="button"
                    variant={watchSettings('primary_color') === c.id ? 'secondary' : 'outline'}
                    disabled={!canEdit}
                    onClick={() => setValueSettings('primary_color', c.id)}
                    className="gap-2"
                  >
                    <span className={`h-4.5 w-4.5 rounded-full ${c.color} shadow-sm`} />
                    {c.name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button type="submit" disabled={!canEdit}>
                Guardar hospital y recibo
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Numeración de facturas</CardTitle>
          <CardDescription>
            Configure el rango autorizado para emitir facturas.
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
                  aria-invalid={Boolean(errorsSequence.prefix)}
                  aria-describedby={errorsSequence.prefix ? 'sequence-prefix-error' : undefined}
                />
                {errorsSequence.prefix && (
                  <p id="sequence-prefix-error" role="alert" className="text-sm text-destructive">{errorsSequence.prefix.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="cai">CAI *</Label>
                <Input
                  id="cai"
                  {...registerSequence('cai')}
                  placeholder="CAI-XXXXX-XXXXX-XXXXX"
                  aria-invalid={Boolean(errorsSequence.cai)}
                  aria-describedby={errorsSequence.cai ? 'sequence-cai-error' : undefined}
                />
                {errorsSequence.cai && (
                  <p id="sequence-cai-error" role="alert" className="text-sm text-destructive">{errorsSequence.cai.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="min_number">Desde el número *</Label>
                <Input
                  id="min_number"
                  type="number"
                  {...registerSequence('min_number', { valueAsNumber: true })}
                  placeholder="1"
                  aria-invalid={Boolean(errorsSequence.min_number)}
                  aria-describedby={errorsSequence.min_number ? 'sequence-min-number-error' : undefined}
                />
                {errorsSequence.min_number && (
                  <p id="sequence-min-number-error" role="alert" className="text-sm text-destructive">{errorsSequence.min_number.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_number">Hasta el número *</Label>
                <Input
                  id="max_number"
                  type="number"
                  {...registerSequence('max_number', { valueAsNumber: true })}
                  placeholder="10000"
                  aria-invalid={Boolean(errorsSequence.max_number)}
                  aria-describedby={errorsSequence.max_number ? 'sequence-max-number-error' : undefined}
                />
                {errorsSequence.max_number && (
                  <p id="sequence-max-number-error" role="alert" className="text-sm text-destructive">{errorsSequence.max_number.message}</p>
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
                Guardar numeración
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
