import { useEffect, useState } from 'react';
import {
  type FiscalSequence,
  type FiscalSettings,
  apiClient,
  userSafeErrorMessage,
} from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { LoadingState } from '@/components/ui/states';
import { FiscalStatusCard } from './components/FiscalStatusCard';
import { FiscalSummary } from './components/FiscalSummary';
import { FiscalSettingsForm } from './components/FiscalSettingsForm';
import type { SettingsFormData, SequenceFormData } from './components/FiscalSettingsForm';

type FiscalSettingsViewProps = {
  canEdit: boolean;
  onStatus: (message: string) => void;
};

export function FiscalSettingsView({ canEdit, onStatus }: FiscalSettingsViewProps) {
  const [settings, setSettings] = useState<FiscalSettings | null>(null);
  const [sequence, setSequence] = useState<FiscalSequence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadFiscalConfiguration();
  }, []);

  async function loadFiscalConfiguration() {
    setLoading(true);
    setError('');

    try {
      const [settingsData, sequenceData] = await Promise.all([
        apiClient.getFiscalSettings(),
        apiClient.getFiscalSequences(),
      ]);

      setSettings(settingsData);
      setSequence(sequenceData[0] ?? null);
    } catch (err) {
      const message = userSafeErrorMessage(err, 'No se pudo cargar la configuración fiscal.');
      setError(message);
      onStatus(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings(data: SettingsFormData) {
    onStatus('Guardando configuración fiscal...');

    try {
      const updated = await apiClient.updateFiscalSettings({
        hospital_name: data.hospital_name,
        rtn: data.rtn,
        receipt_width: data.receipt_width,
        default_tax_rate: settings?.default_tax_rate ?? '15.00',
      });
      setSettings(updated);
      onStatus('Configuración fiscal guardada.');
    } catch (err) {
      const message = userSafeErrorMessage(err, 'No se pudo guardar la configuración fiscal.');
      setError(message);
      onStatus(message);
      throw err;
    }
  }

  async function handleSaveSequence(data: SequenceFormData) {
    onStatus('Guardando secuencia fiscal...');

    try {
      const saved = await apiClient.saveFiscalSequence({
        id: sequence?.id,
        document_type: 'invoice',
        prefix: data.prefix,
        cai: data.cai,
        min_number: data.min_number,
        max_number: data.max_number,
        current_number: sequence?.current_number ?? 0,
        valid_until: data.valid_until,
        active: true,
      });
      setSequence(saved);
      onStatus('Secuencia fiscal guardada.');
    } catch (err) {
      const message = userSafeErrorMessage(err, 'No se pudo guardar la secuencia fiscal.');
      setError(message);
      onStatus(message);
      throw err;
    }
  }

  if (loading) {
    return <LoadingState label="Cargando configuración fiscal..." />;
  }

  return (
    <>
      <PageHeader
        title="Configuración Fiscal"
        description="Configure los datos fiscales y la secuencia de facturación para emitir recibos."
      />

      {error ? (
        <Alert variant="destructive" title="Error">
          {error}
        </Alert>
      ) : null}

      <div className="space-y-6">
        <FiscalStatusCard settings={settings} sequence={sequence} />
        <FiscalSummary settings={settings} sequence={sequence} />
        <FiscalSettingsForm
          settings={settings}
          sequence={sequence}
          canEdit={canEdit}
          onSaveSettings={handleSaveSettings}
          onSaveSequence={handleSaveSequence}
        />
      </div>
    </>
  );
}