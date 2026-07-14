import { useCallback, useEffect, useState } from 'react';
import { FileTextOutlined as FileText } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { Alert, Button, Flex, Grid, Tabs, Tag } from 'antd';
import { type FiscalSequence, type FiscalSettings, apiClient, userSafeErrorMessage } from '@/lib/api';
import { FiscalStatusCard } from './components/FiscalStatusCard';
import { FiscalSummary } from './components/FiscalSummary';
import { HospitalSettingsView } from './HospitalSettingsView';
import { FiscalNumerationView } from './FiscalNumerationView';
import { OperationalRulesView } from './OperationalRulesView';
import { BrandingView } from './BrandingView';
import { PageHeader } from '@/design-system/components/PageHeader';

type FiscalSettingsViewProps = {
  canEdit: boolean;
  canEditOperationalRules: boolean;
  canViewFiscalSettings: boolean;
  onStatus: (message: string) => void;
};

export function FiscalSettingsView({ canEdit, canEditOperationalRules, canViewFiscalSettings, onStatus }: FiscalSettingsViewProps) {
  const screens = Grid.useBreakpoint();
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
        actions={<Tag color={canEdit || canEditOperationalRules ? 'success' : 'default'}>
          {canEdit ? 'Edición habilitada' : canEditOperationalRules ? 'Edición operativa' : 'Solo lectura'}
        </Tag>}
      />

      {error ? (
        <Alert type="error" showIcon title="Error" description={error} />
      ) : null}

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        tabPlacement={screens.md === false ? 'start' : 'top'}
        items={[
          ...(canViewFiscalSettings ? [{ key: 'resumen', label: 'Resumen', children: (
          <div className="min-w-0 space-y-6">
            <Flex justify="space-between" align="center" wrap="wrap" className="border border-operational-border bg-operational-surface p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Documentos institucionales</p>
                <p className="mt-1 text-xs text-muted-foreground">Configure papel, contenido y vista previa fuera de los datos fiscales.</p>
              </div>
              <Link to="/settings/institutional-receipts"><Button icon={<FileText aria-hidden="true" />}>Administrar recibos</Button></Link>
            </Flex>
            <FiscalStatusCard settings={settings} sequence={sequence} />
            <FiscalSummary settings={settings} sequence={sequence} />
          </div>
          ) }, { key: 'hospital', label: 'Hospital', children: <HospitalSettingsView canEdit={canEdit} onStatus={onStatus} /> }, { key: 'numeracion', label: 'Numeración', children: <FiscalNumerationView canEdit={canEdit} onStatus={onStatus} /> }] : []),
          { key: 'operativa', label: 'Operativa', children: <OperationalRulesView canEdit={canEditOperationalRules} onStatus={onStatus} /> },
          ...(canViewFiscalSettings ? [{ key: 'marca', label: 'Marca', children: <BrandingView canEdit={canEdit} onStatus={onStatus} /> }] : []),
        ]}
      />
    </div>
  );
}
