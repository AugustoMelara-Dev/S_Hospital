import { useEffect, useState } from 'react';
import { type FiscalSequence, type FiscalSettings, apiClient, userSafeErrorMessage } from '@/lib/api';
import { useCallback } from 'react';
import { Alert } from '@/components/ui/alert';
import { ActionBar } from '@/components/ui/action-bar';
import { InfoPanel, OperationalBanner, StatGrid } from '@/components/shared';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/ui/status-badge';
import { FiscalStatusCard } from './components/FiscalStatusCard';
import { FiscalSummary } from './components/FiscalSummary';
import { HospitalSettingsView } from './HospitalSettingsView';
import { FiscalNumerationView } from './FiscalNumerationView';
import { OperationalRulesView } from './OperationalRulesView';
import { BrandingView } from './BrandingView';
import { Link } from 'react-router-dom';

type FiscalSettingsViewProps = {
  canEdit: boolean;
  onStatus: (message: string) => void;
};

export function FiscalSettingsView({ canEdit, onStatus }: FiscalSettingsViewProps) {
  const [activeTab, setActiveTab] = useState('resumen');
  const [settings, setSettings] = useState<FiscalSettings | null>(null);
  const [sequence, setSequence] = useState<FiscalSequence | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [data, sequences] = await Promise.all([
        apiClient.getFiscalSettings(),
        apiClient.getFiscalSequences(),
      ]);
      setSettings(data);
      setSequence(sequences.find((candidate) => candidate.active) ?? sequences[0] ?? null);
    } catch (err) {
      const message = userSafeErrorMessage(err, 'No se pudo cargar la configuración.');
      setError(message);
      onStatus(message);
    }
  }, [onStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configuración"
        description="Datos del hospital, numeración fiscal, reglas operativas y marca."
        actions={
          <ActionBar align="end">
            <StatusBadge status={canEdit ? 'success' : 'info'}>
              {canEdit ? 'Edición habilitada' : 'Solo lectura'}
            </StatusBadge>
          </ActionBar>
        }
      />

      <OperationalBanner
        meta="Configuración institucional"
        title="Centro de configuración"
        titleLevel={2}
        description="Cada sección tiene su propio permiso y auditoría. Cambios fiscales piden motivo."
        tone="info"
      />

      <StatGrid
        items={[
          {
            label: 'Hospital',
            value: settings?.hospital_name || 'Pendiente',
            helper: settings?.rtn ? `RTN ${settings.rtn}` : 'RTN sin configurar',
            tone: settings?.hospital_name ? 'success' : 'warning',
          },
          {
            label: 'Recibo',
            value: 'Recibos',
            helper: <Link to="/settings/institutional-receipts" className="underline">Administrar recibos</Link>,
            tone: 'info',
          },
          {
            label: 'Permiso',
            value: canEdit ? 'Editable' : 'Solo lectura',
            tone: canEdit ? 'success' : 'warning',
          },
        ]}
      />

      <InfoPanel
        title="Secciones de configuración"
        description="Hospital, numeración fiscal, reglas operativas y marca. Los recibos se administran en su pantalla dedicada."
        tone="info"
      />

      {error ? (
        <Alert variant="destructive" title="Error">
          {error}
        </Alert>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="overflow-x-auto pb-1">
          <TabsList className="min-w-max border border-operational-border bg-operational-panel p-1">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="hospital">Hospital</TabsTrigger>
            <TabsTrigger value="numeracion">Numeración</TabsTrigger>
            <TabsTrigger value="operativa">Operativa</TabsTrigger>
            <TabsTrigger value="marca">Marca</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="resumen" className="mt-0 space-y-6">
          <FiscalStatusCard settings={settings} sequence={sequence} />
          <FiscalSummary settings={settings} sequence={sequence} />
        </TabsContent>

        <TabsContent value="hospital" className="mt-0">
          <HospitalSettingsView canEdit={canEdit} onStatus={onStatus} />
        </TabsContent>

        <TabsContent value="numeracion" className="mt-0">
          <FiscalNumerationView canEdit={canEdit} onStatus={onStatus} />
        </TabsContent>

        <TabsContent value="operativa" className="mt-0">
          <OperationalRulesView canEdit={canEdit} onStatus={onStatus} />
        </TabsContent>

        <TabsContent value="marca" className="mt-0">
          <BrandingView canEdit={canEdit} onStatus={onStatus} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
