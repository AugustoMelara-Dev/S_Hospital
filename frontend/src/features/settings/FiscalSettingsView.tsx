import { useCallback, useEffect, useState } from 'react';
import { FileTextOutlined as FileText } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { type FiscalSequence, type FiscalSettings, apiClient, userSafeErrorMessage } from '@/lib/api';
import { FiscalStatusCard } from './components/FiscalStatusCard';
import { FiscalSummary } from './components/FiscalSummary';
import { HospitalSettingsView } from './HospitalSettingsView';
import { FiscalNumerationView } from './FiscalNumerationView';
import { OperationalRulesView } from './OperationalRulesView';
import { BrandingView } from './BrandingView';
import { ActionBar, Alert, Button, PageHeader, StatusBadge, Tabs, TabsContent, TabsList, TabsTrigger } from './settingsAntd';

type FiscalSettingsViewProps = {
  canEdit: boolean;
  canEditOperationalRules: boolean;
  canViewFiscalSettings: boolean;
  onStatus: (message: string) => void;
};

export function FiscalSettingsView({ canEdit, canEditOperationalRules, canViewFiscalSettings, onStatus }: FiscalSettingsViewProps) {
  const [activeTab, setActiveTab] = useState(() => (canViewFiscalSettings ? 'resumen' : 'operativa'));
  const [settings, setSettings] = useState<FiscalSettings | null>(null);
  const [sequence, setSequence] = useState<FiscalSequence | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!canViewFiscalSettings) {
      setSettings(null);
      setSequence(null);
      return;
    }

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
  }, [canViewFiscalSettings, onStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canViewFiscalSettings && activeTab !== 'operativa') {
      setActiveTab('operativa');
    }
  }, [activeTab, canViewFiscalSettings]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configuración"
        description="Configure identidad hospitalaria, numeración fiscal, reglas operativas y presentación de documentos."
        actions={
          <ActionBar align="end">
            <StatusBadge status={canEdit || canEditOperationalRules ? 'success' : 'info'}>
              {canEdit ? 'Edición habilitada' : canEditOperationalRules ? 'Edición operativa' : 'Solo lectura'}
            </StatusBadge>
          </ActionBar>
        }
      />

      {error ? (
        <Alert variant="destructive" title="Error">
          {error}
        </Alert>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="grid items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="overflow-x-auto border border-operational-border bg-operational-surface p-3 lg:sticky lg:top-24 lg:overflow-visible">
          <div className="hidden border-b border-border px-3 pb-4 pt-2 lg:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary">Configuración</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{settings?.hospital_name || 'Hospital'}</p>
            <p className="mt-1 text-xs text-muted-foreground">{settings?.rtn ? `RTN ${settings.rtn}` : 'Identidad pendiente'}</p>
          </div>
          <TabsList className="min-w-max border-0 bg-transparent p-0 lg:flex lg:min-w-0 lg:flex-col lg:items-stretch lg:gap-1">
            {canViewFiscalSettings ? <TabsTrigger value="resumen">Resumen</TabsTrigger> : null}
            {canViewFiscalSettings ? <TabsTrigger value="hospital">Hospital</TabsTrigger> : null}
            {canViewFiscalSettings ? <TabsTrigger value="numeracion">Numeración</TabsTrigger> : null}
            <TabsTrigger value="operativa">Operativa</TabsTrigger>
            {canViewFiscalSettings ? <TabsTrigger value="marca">Marca</TabsTrigger> : null}
          </TabsList>
        </aside>

        {canViewFiscalSettings ? (
          <TabsContent value="resumen" className="mt-0 min-w-0 space-y-6">
            <ActionBar className="justify-between border border-operational-border bg-operational-surface p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Documentos institucionales</p>
                <p className="mt-1 text-xs text-muted-foreground">Configure papel, contenido y vista previa fuera de los datos fiscales.</p>
              </div>
              <Button asChild variant="outline">
                <Link to="/settings/institutional-receipts">
                  <FileText data-icon aria-hidden="true" />
                  Administrar recibos
                </Link>
              </Button>
            </ActionBar>
            <FiscalStatusCard settings={settings} sequence={sequence} />
            <FiscalSummary settings={settings} sequence={sequence} />
          </TabsContent>
        ) : null}

        {canViewFiscalSettings ? (
          <TabsContent value="hospital" className="mt-0 min-w-0">
            <HospitalSettingsView canEdit={canEdit} onStatus={onStatus} />
          </TabsContent>
        ) : null}

        {canViewFiscalSettings ? (
          <TabsContent value="numeracion" className="mt-0 min-w-0">
            <FiscalNumerationView canEdit={canEdit} onStatus={onStatus} />
          </TabsContent>
        ) : null}

        <TabsContent value="operativa" className="mt-0 min-w-0">
          <OperationalRulesView canEdit={canEditOperationalRules} onStatus={onStatus} />
        </TabsContent>

        {canViewFiscalSettings ? (
          <TabsContent value="marca" className="mt-0 min-w-0">
            <BrandingView canEdit={canEdit} onStatus={onStatus} />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
