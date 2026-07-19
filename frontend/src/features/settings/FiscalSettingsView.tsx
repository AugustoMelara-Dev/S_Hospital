import { useCallback, useEffect, useState } from 'react';
import { FileText, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type FiscalSequence, type FiscalSettings, apiClient, userSafeErrorMessage } from '@/lib/api';
import { FiscalStatusCard } from './components/FiscalStatusCard';
import { FiscalSummary } from './components/FiscalSummary';
import { HospitalSettingsView } from './HospitalSettingsView';
import { FiscalNumerationView } from './FiscalNumerationView';
import { OperationalRulesView } from './OperationalRulesView';
import { BrandingView } from './BrandingView';
import type { OperationalStatusReporter } from '@/app/operationalStatus';

type FiscalSettingsViewProps = {
  canEdit: boolean;
  canEditOperationalRules: boolean;
  canViewFiscalSettings: boolean;
  onStatus: OperationalStatusReporter;
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
      onStatus({ key: 'settings:fiscal:load', level: 'error', message, toast: false });
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-tight text-foreground sm:text-2xl">Configuración hospitalaria</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Identidad hospitalaria, numeración fiscal, reglas operativas, marca y documentos institucionales.
          </p>
        </div>
        <Badge className="w-fit" variant={canEdit || canEditOperationalRules ? 'secondary' : 'outline'}>
          {canEdit ? 'Edición habilitada' : canEditOperationalRules ? 'Edición operativa' : 'Solo lectura'}
        </Badge>
      </div>

      {error ? (
        <Alert variant="destructive"><TriangleAlert /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto w-full flex-wrap justify-start" aria-label="Secciones de configuración">
          {canViewFiscalSettings ? <><TabsTrigger value="resumen">Resumen</TabsTrigger><TabsTrigger value="hospital">Hospital</TabsTrigger><TabsTrigger value="numeracion">Numeración</TabsTrigger></> : null}
          <TabsTrigger value="operativa">Operativa</TabsTrigger>
          {canViewFiscalSettings ? <TabsTrigger value="marca">Marca</TabsTrigger> : null}
        </TabsList>
        {canViewFiscalSettings ? (
          <>
            <TabsContent value="resumen" className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
                <div><p className="text-sm font-semibold">Documentos institucionales</p><p className="text-xs text-muted-foreground">Configure papel, contenido y vista previa fuera de los datos fiscales.</p></div>
                <Button asChild variant="outline"><Link to="/settings/institutional-receipts"><FileText data-icon="inline-start" />Administrar recibos</Link></Button>
              </div>
              <FiscalStatusCard settings={settings} sequence={sequence} />
              <FiscalSummary settings={settings} sequence={sequence} />
            </TabsContent>
            <TabsContent value="hospital"><HospitalSettingsView canEdit={canEdit} onStatus={onStatus} /></TabsContent>
            <TabsContent value="numeracion"><FiscalNumerationView canEdit={canEdit} onStatus={onStatus} /></TabsContent>
            <TabsContent value="marca"><BrandingView canEdit={canEdit} onStatus={onStatus} /></TabsContent>
          </>
        ) : null}
        <TabsContent value="operativa"><OperationalRulesView canEdit={canEditOperationalRules} onStatus={onStatus} /></TabsContent>
      </Tabs>
    </div>
  );
}
