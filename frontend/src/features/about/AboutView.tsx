import { useEffect, useState } from 'react';
import { Building2, HardDrive, HeartHandshake, ShieldCheck } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { useFiscalSettings } from '../../hooks/useFiscalSettings';
import { useServerStatus } from '../../hooks/useServerStatus';
import { apiClient } from '../../lib/api';
import { displayHospitalName } from '../../lib/hospital-name';

type AboutViewProps = {
  onStatus: (message: string) => void;
};

export function AboutView({ onStatus }: AboutViewProps) {
  const { data: fiscal } = useFiscalSettings();
  const { checking, isOnline, lastCheck, summary } = useServerStatus();
  const [backupCount, setBackupCount] = useState<number | string>('...');
  const hospitalName = displayHospitalName(fiscal?.hospital_name);

  useEffect(() => {
    async function fetchBackupCount() {
      try {
        const backupsData = await apiClient.getBackups();
        setBackupCount(Array.isArray(backupsData.data) ? backupsData.data.length : 0);
      } catch {
        setBackupCount('Sin dato');
      }
    }

    void fetchBackupCount();
  }, []);

  const triggerDiagnosticTest = () => {
    onStatus('Revisando conexion local...');
    window.setTimeout(() => {
      onStatus(checking ? 'Revision local en curso.' : `${summary.label}: ${summary.description}`);
    }, 1000);
  };

  return (
    <section id="about" className="flex flex-col gap-6" aria-labelledby="about-title">
      <PageHeader
        title="Informacion del sistema"
        description="Estado general de operacion local, respaldos y soporte."
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-start gap-4 pb-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-xl font-bold">{hospitalName}</CardTitle>
                <Badge variant="success">Activo</Badge>
              </div>
              <CardDescription>Sistema de caja y facturacion hospitalaria local.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Disenado para operar dentro del hospital con facturacion, caja, reportes,
              recibos institucionales y respaldos locales.
            </p>

            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <h3 className="mb-2 text-sm font-semibold text-foreground">Operacion local</h3>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground">Sistema disponible en la red del hospital</p>
                  <p className="text-xs text-muted-foreground">Uso local para caja, facturacion, reportes y respaldos.</p>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-success/20 bg-success/10 px-2.5 py-1 text-xs font-bold text-success">
                  <ShieldCheck className="h-4 w-4" />
                  Activa
                </div>
              </div>

              <div className="mt-4 border-t border-border pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Resumen operativo</p>
                  <Badge variant={summaryBadgeVariant(summary.level)}>{summary.label}</Badge>
                </div>
                <p className="mt-2 text-sm text-foreground">{summary.description}</p>
              </div>
            </div>

            <Button type="button" onClick={triggerDiagnosticTest} variant="secondary" size="sm">
              Revisar conexion local
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold">Estado local</CardTitle>
            <CardDescription>Senales utiles para soporte del hospital.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between border-b border-border py-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Servidor local</span>
              <Badge variant={isOnline ? 'success' : 'destructive'}>
                {isOnline ? 'Conectado' : 'Desconectado'}
              </Badge>
            </div>

            <div className="flex items-center justify-between border-b border-border py-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Diagnostico</span>
              <Badge variant={summaryBadgeVariant(summary.level)}>{summary.label}</Badge>
            </div>

            <div className="flex items-center justify-between border-b border-border py-1.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <HardDrive className="h-3.5 w-3.5" /> Respaldos
              </span>
              <span className="text-xs font-bold text-foreground">{backupCount}</span>
            </div>

            <div className="pt-2 text-center text-[11px] text-muted-foreground">
              Ultima revision: {lastCheck ? lastCheck.toLocaleTimeString() : 'pendiente'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <HeartHandshake className="h-5 w-5 text-secondary" /> Soporte
          </CardTitle>
          <CardDescription>Informacion para continuidad operativa.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 text-sm text-muted-foreground sm:grid-cols-2">
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Continuidad de caja</p>
            <p>Ante una incidencia, contacte al responsable del sistema antes de seguir facturando.</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Respaldos</p>
            <p>Confirme respaldos completados y conserve una copia externa cuando corresponda.</p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function summaryBadgeVariant(level: 'ok' | 'review' | 'error'): 'success' | 'warning' | 'destructive' {
  if (level === 'ok') {
    return 'success';
  }

  if (level === 'review') {
    return 'warning';
  }

  return 'destructive';
}
