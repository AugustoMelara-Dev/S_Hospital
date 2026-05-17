import { type FormEvent, useEffect, useState } from 'react';
import {
  type FiscalSequence,
  type FiscalSettings,
  apiClient,
} from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { PageHeader } from '../../components/ui/page-header';
import { Select } from '../../components/ui/select';
import { LoadingState } from '../../components/ui/states';

const emptySequence: FiscalSequence = {
  document_type: 'invoice',
  prefix: '',
  min_number: 1,
  max_number: 99999999,
  current_number: 0,
  cai: '',
  valid_until: '',
  active: false,
};

type FiscalSettingsViewProps = {
  canEdit: boolean;
  onStatus: (message: string) => void;
};

export function FiscalSettingsView({ canEdit, onStatus }: FiscalSettingsViewProps) {
  const [settings, setSettings] = useState<FiscalSettings>({
    hospital_name: '',
    rtn: '',
    default_tax_rate: '15.00',
    receipt_width: '80mm',
  });
  const [sequences, setSequences] = useState<FiscalSequence[]>([]);
  const [sequenceForm, setSequenceForm] = useState<FiscalSequence>(emptySequence);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiClient.getFiscalSettings(), apiClient.getFiscalSequences()])
      .then(([settingsData, sequenceData]) => {
        if (settingsData) {
          setSettings(settingsData);
        }

        setSequences(sequenceData);
        setSequenceForm(sequenceData[0] ?? emptySequence);
      })
      .catch((error: Error) => onStatus(error.message))
      .finally(() => setLoading(false));
  }, [onStatus]);

  async function handleFiscalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onStatus('Guardando configuracion fiscal...');

    try {
      const updated = await apiClient.updateFiscalSettings(settings);
      setSettings(updated);
      onStatus('Configuracion fiscal guardada.');
    } catch (error) {
      onStatus(error instanceof Error ? error.message : 'No se pudo guardar.');
    }
  }

  async function handleSequenceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onStatus('Guardando secuencia fiscal...');

    try {
      const saved = await apiClient.saveFiscalSequence(sequenceForm);
      const nextSequences = sequenceForm.id
        ? sequences.map((sequence) => (sequence.id === saved.id ? saved : sequence))
        : [saved, ...sequences];
      setSequences(nextSequences);
      setSequenceForm(saved);
      onStatus('Secuencia fiscal guardada.');
    } catch (error) {
      onStatus(error instanceof Error ? error.message : 'No se pudo guardar la secuencia.');
    }
  }

  if (loading) {
    return <LoadingState label="Cargando configuracion fiscal..." />;
  }

  return (
    <>
      <PageHeader
        title="Configuracion fiscal"
        description="Datos fiscales, ancho de recibo y secuencia autorizada para facturacion local."
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader>
            <CardTitle>Datos fiscales del hospital</CardTitle>
            <CardDescription>El backend valida permisos antes de guardar cambios.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleFiscalSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
                Hospital
                <Input
                  value={settings.hospital_name}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setSettings({ ...settings, hospital_name: event.target.value })
                  }
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
                RTN
                <Input
                  value={settings.rtn}
                  disabled={!canEdit}
                  onChange={(event) => setSettings({ ...settings, rtn: event.target.value })}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
                ISV por defecto
                <Input
                  value={settings.default_tax_rate}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setSettings({ ...settings, default_tax_rate: event.target.value })
                  }
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
                Ancho de recibo
                <Select
                  value={settings.receipt_width}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      receipt_width: event.target.value as FiscalSettings['receipt_width'],
                    })
                  }
                >
                  <option value="80mm">80mm</option>
                  <option value="58mm">58mm</option>
                </Select>
              </label>
              <Button type="submit" disabled={!canEdit}>
                Guardar configuracion
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Secuencia fiscal</CardTitle>
            <CardDescription>Rango, CAI y correlativo activo para facturas.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSequenceSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
                CAI
                <Input
                  value={sequenceForm.cai}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setSequenceForm({ ...sequenceForm, cai: event.target.value })
                  }
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
                Prefijo
                <Input
                  value={sequenceForm.prefix}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setSequenceForm({ ...sequenceForm, prefix: event.target.value })
                  }
                />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
                  Rango minimo
                  <Input
                    type="number"
                    value={sequenceForm.min_number}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setSequenceForm({
                        ...sequenceForm,
                        min_number: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
                  Rango maximo
                  <Input
                    type="number"
                    value={sequenceForm.max_number}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setSequenceForm({
                        ...sequenceForm,
                        max_number: Number(event.target.value),
                      })
                    }
                  />
                </label>
              </div>
              <label className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
                Correlativo actual
                <Input
                  type="number"
                  value={sequenceForm.current_number}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setSequenceForm({
                      ...sequenceForm,
                      current_number: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
                Fecha limite
                <Input
                  type="date"
                  value={sequenceForm.valid_until}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setSequenceForm({ ...sequenceForm, valid_until: event.target.value })
                  }
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <input
                  type="checkbox"
                  checked={sequenceForm.active}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setSequenceForm({ ...sequenceForm, active: event.target.checked })
                  }
                />
                Secuencia activa
              </label>
              <Button type="submit" disabled={!canEdit}>
                Guardar secuencia
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Secuencias</CardTitle>
            <CardDescription>Seleccione una secuencia para editarla.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {sequences.length > 0 ? (
              sequences.map((sequence) => (
                <Button
                  key={sequence.id}
                  type="button"
                  variant="secondary"
                  className="justify-start"
                  onClick={() => setSequenceForm(sequence)}
                >
                  {sequence.prefix} - {sequence.active ? 'Activa' : 'Inactiva'}
                </Button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No hay secuencias registradas.</p>
            )}
            <p className="pt-2 text-sm text-muted-foreground">
              {canEdit
                ? 'Admin puede editar. El backend valida el permiso.'
                : 'Lectura protegida. Solo admin puede editar configuracion fiscal.'}
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
