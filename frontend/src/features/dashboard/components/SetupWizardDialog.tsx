import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, FileCheck2, Hospital, Upload } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { apiClient, userSafeErrorMessage } from '@/lib/api';
import { parseCents } from '@/lib/moneyCents';
import { cn } from '@/lib/utils';

type SetupWizardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
};

export type SetupStatus = {
  needs_setup: boolean;
  steps: {
    fiscal_settings: boolean;
    admin_exists: boolean;
    catalog_has_services: boolean;
    fiscal_sequence_exists: boolean;
  };
};

const wizardSteps = ['Hospital', 'Numeración', 'Catálogo', 'Finalizar'];

export function SetupWizardDialog({ open, onOpenChange, onComplete }: SetupWizardDialogProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hospitalForm, setHospitalForm] = useState({
    hospital_name: '', rtn: '', default_tax_rate: '15.00',
    primary_color: 'indigo' as 'teal' | 'blue' | 'indigo' | 'green' | 'rose', address: '', slogan: '',
  });
  const [sequenceForm, setSequenceForm] = useState({
    prefix: '000-001-01', cai: '', min_number: 1, max_number: 99999999, valid_until: '',
  });
  const [csvText, setCsvText] = useState(
    `Categoría, Servicio, Precio, Grabado (S/N)\nConsulta, Consulta General, 250.00, N\nConsulta, Consulta Especialista, 600.00, N\nLaboratorio, Hemograma Completo, 180.00, S\nLaboratorio, Perfil Lipídico, 350.00, S\nImagenología, Radiografía Tórax AP, 450.00, N\nMedicamentos, Eritropoyetina 4000 UI, 25.00, N`,
  );
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    if (open) void loadExistingSetup();
  }, [open]);

  async function loadExistingSetup() {
    try {
      const [settings, sequences] = await Promise.all([apiClient.getFiscalSettings(), apiClient.getFiscalSequences()]);
      if (settings) {
        setHospitalForm({
          hospital_name: settings.hospital_name || '', rtn: settings.rtn || '',
          default_tax_rate: settings.default_tax_rate || '15.00', primary_color: settings.primary_color || 'indigo',
          address: settings.address || '', slogan: settings.slogan || '',
        });
      }
      if (sequences?.length) {
        const seq = sequences[0];
        setSequenceForm({
          prefix: seq.prefix || '000-001-01', cai: seq.cai || '', min_number: seq.min_number || 1,
          max_number: seq.max_number || 99999999, valid_until: seq.valid_until || '',
        });
      }
    } catch {
      // Defaults keep the local setup flow usable when no prior configuration exists.
    }
  }

  async function handleSaveHospital() {
    if (!hospitalForm.hospital_name.trim()) {
      setError('El nombre del hospital es obligatorio.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await apiClient.updateFiscalSettings(hospitalForm);
      setStep(2);
    } catch (err) {
      setError(userSafeErrorMessage(err, 'No se pudo guardar la configuración del hospital.'));
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSequence() {
    if (!sequenceForm.prefix.trim() || !sequenceForm.cai.trim() || !sequenceForm.valid_until) {
      setError('El prefijo, CAI y la fecha límite de emisión son obligatorios.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await apiClient.saveFiscalSequence({ document_type: 'invoice', ...sequenceForm, current_number: 0, active: true });
      setStep(3);
    } catch (err) {
      setError(userSafeErrorMessage(err, 'No se pudo guardar la secuencia fiscal.'));
    } finally {
      setLoading(false);
    }
  }

  function parseCSV(text: string) {
    const lines = text.split('\n');
    const result: Array<{ category: string; area: string; service: string; price: string; taxable: boolean }> = [];
    const startIdx = lines[0].toLowerCase().includes('categor') ? 1 : 0;
    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i].trim().split(',').map((part) => part.trim());
      if (parts.length < 3) continue;
      const hasAreaColumn = parts.length >= 5;
      const [category, area, service, price, taxableInput] = hasAreaColumn
        ? parts
        : [parts[0], parts[0], parts[1], parts[2], parts[3]];
      const taxableValue = (taxableInput || 'S').toUpperCase();
      if (category && area && service && parseCents(price) !== null) {
        result.push({ category, area, service, price, taxable: ['S', 'SI', 'Y', 'YES', '1'].includes(taxableValue) });
      }
    }
    return result;
  }

  async function handleImportCatalog() {
    const parsed = parseCSV(csvText);
    if (!parsed.length) {
      setError('No se encontraron servicios válidos en el formato CSV provisto.');
      return;
    }
    setLoading(true);
    setError('');
    setImportProgress({ current: 0, total: parsed.length });
    try {
      const [existingCats, existingAreas] = await Promise.all([apiClient.getCategories(), apiClient.getAreas(true)]);
      const catMap = new Map(existingCats.map((category) => [category.name.toLowerCase(), category.id]));
      const areaMap = new Map(existingAreas.map((area) => [normalizeCatalogName(area.name), area.id]));
      for (let index = 0; index < parsed.length; index++) {
        const item = parsed[index];
        setImportProgress({ current: index + 1, total: parsed.length });
        const areaId = findCatalogAreaId(areaMap, item.area);
        if (!areaId) throw new Error(`No existe el área "${item.area}". Revise el catálogo base antes de importar servicios.`);
        let categoryId = catMap.get(item.category.toLowerCase());
        if (!categoryId) {
          const category = await apiClient.saveCategory({ name: item.category, active: true, sort_order: existingCats.length + 10 });
          categoryId = category.id;
          catMap.set(item.category.toLowerCase(), categoryId);
        }
        await apiClient.saveService({
          category_id: categoryId, area_id: areaId, name: item.service, price: item.price,
          taxable: item.taxable, active: true, scan_code: null, barcode: null, qr_code: null, special_rule_code: null,
        });
      }
      setStep(4);
    } catch (err) {
      setError(userSafeErrorMessage(err, 'Ocurrió un error al importar los servicios del catálogo.'));
    } finally {
      setLoading(false);
      setImportProgress(null);
    }
  }

  const submit = (handler: () => Promise<void>) => (event: FormEvent) => {
    event.preventDefault();
    void handler();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-svh overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle asChild><h3>Preparar caja</h3></DialogTitle>
          <DialogDescription>Complete los datos mínimos para comenzar a facturar.</DialogDescription>
        </DialogHeader>

        <ol aria-label="Progreso de configuración" className="grid grid-cols-4 gap-2">
          {wizardSteps.map((label, index) => {
            const position = index + 1;
            return (
              <li key={label} aria-current={position === step ? 'step' : undefined} className="flex min-w-0 flex-col gap-2">
                <Progress value={position < step ? 100 : position === step ? 50 : 0} aria-label={`${label}: paso ${position} de 4`} />
                <span className={cn('truncate text-xs', position === step ? 'font-medium text-foreground' : 'text-muted-foreground')}>{label}</span>
              </li>
            );
          })}
        </ol>

        {error ? <Alert variant="destructive"><AlertTitle>No se pudo guardar</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}

        {step === 1 ? (
          <form onSubmit={submit(handleSaveHospital)} className="flex flex-col gap-6">
            <StepNotice icon={Hospital} title="Paso 1: Datos del hospital" description="Estos datos aparecen en facturas, recibos y pantalla de ingreso." />
            <FieldGroup>
              <TextField id="wiz-hosp-name" label="Nombre del hospital *" value={hospitalForm.hospital_name} onChange={(value) => setHospitalForm({ ...hospitalForm, hospital_name: value })} placeholder="Hospital General El Buen Pastor" />
              <TextField id="wiz-hosp-rtn" label="RTN *" value={hospitalForm.rtn} onChange={(value) => setHospitalForm({ ...hospitalForm, rtn: value })} placeholder="0801-1990-123456" />
              <TextField id="wiz-hosp-tax" label="Impuesto general (%)" type="number" step="0.01" value={hospitalForm.default_tax_rate} onChange={(value) => setHospitalForm({ ...hospitalForm, default_tax_rate: value })} placeholder="15.00" />
            </FieldGroup>
            <div className="flex justify-end"><Button type="submit" disabled={loading}>{loading ? <Spinner data-icon="inline-start" /> : null}Siguiente<ArrowRight data-icon="inline-end" /></Button></div>
          </form>
        ) : null}

        {step === 2 ? (
          <form onSubmit={submit(handleSaveSequence)} className="flex flex-col gap-6">
            <StepNotice icon={FileCheck2} title="Paso 2: Numeración de facturas" description="Registre el CAI, prefijo y rango autorizado para imprimir facturas." />
            <FieldGroup>
              <TextField id="wiz-seq-prefix" label="Prefijo *" value={sequenceForm.prefix} onChange={(value) => setSequenceForm({ ...sequenceForm, prefix: value })} placeholder="000-001-01" />
              <TextField id="wiz-seq-cai" label="CAI *" value={sequenceForm.cai} onChange={(value) => setSequenceForm({ ...sequenceForm, cai: value.toUpperCase() })} placeholder="4D82C1-30AAFF-8C4212-..." />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField id="wiz-seq-min" label="Desde el número *" type="number" value={String(sequenceForm.min_number)} onChange={(value) => setSequenceForm({ ...sequenceForm, min_number: Number.parseInt(value) || 1 })} />
                <TextField id="wiz-seq-max" label="Hasta el número *" type="number" value={String(sequenceForm.max_number)} onChange={(value) => setSequenceForm({ ...sequenceForm, max_number: Number.parseInt(value) || 99999999 })} />
              </div>
              <TextField id="wiz-seq-date" label="Fecha límite *" type="date" value={sequenceForm.valid_until} onChange={(value) => setSequenceForm({ ...sequenceForm, valid_until: value })} />
            </FieldGroup>
            <WizardActions onBack={() => setStep(1)} loading={loading} />
          </form>
        ) : null}

        {step === 3 ? (
          <form onSubmit={submit(handleImportCatalog)} className="flex flex-col gap-6">
            <StepNotice icon={Upload} title="Paso 3: Catálogo de servicios" description="Pegue la lista inicial de servicios. Luego podrá editarla desde Catálogo." />
            <Field>
              <FieldLabel htmlFor="wiz-cat-csv">Servicios: categoría, servicio, precio, impuesto</FieldLabel>
              <Textarea id="wiz-cat-csv" rows={8} value={csvText} onChange={(event) => setCsvText(event.target.value)} disabled={loading} className="font-mono text-xs" />
              <FieldDescription>Use S para impuesto o N para exento.</FieldDescription>
            </Field>
            {importProgress ? (
              <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4" role="status">
                <div className="flex justify-between gap-4 text-sm font-medium"><span>Importando servicios…</span><span>{importProgress.current} / {importProgress.total}</span></div>
                <Progress value={Math.round((importProgress.current / importProgress.total) * 100)} />
              </div>
            ) : null}
            <div className="flex justify-between gap-3">
              <Button type="button" variant="outline" onClick={() => setStep(2)} disabled={loading}><ArrowLeft data-icon="inline-start" />Atrás</Button>
              <Button type="submit" disabled={loading}>{loading ? <Spinner data-icon="inline-start" /> : null}{loading ? 'Procesando…' : 'Importar catálogo'}<ArrowRight data-icon="inline-end" /></Button>
            </div>
          </form>
        ) : null}

        {step === 4 ? (
          <div className="flex flex-col items-center gap-6 py-6 text-center">
            <CheckCircle2 aria-hidden="true" className="text-success" />
            <div className="flex flex-col gap-2"><h3 className="text-xl font-semibold">Configuración lista</h3><p className="max-w-md text-muted-foreground">Ya puede iniciar la operación con datos del hospital, numeración y servicios base.</p></div>
            <div className="flex w-full max-w-sm flex-col gap-3 rounded-lg border bg-muted/20 p-5 text-left">
              {['Datos del hospital guardados', 'Numeración lista para facturar', 'Catálogo importado'].map((label) => <span key={label} className="flex items-center gap-2 text-xs font-semibold text-success"><CheckCircle2 aria-hidden="true" />{label}</span>)}
            </div>
            <Button onClick={() => { onComplete(); onOpenChange(false); }}>Entrar</Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TextField({ id, label, onChange, ...props }: Omit<React.ComponentProps<typeof Input>, 'id' | 'onChange'> & { id: string; label: string; onChange: (value: string) => void }) {
  return <Field><FieldLabel htmlFor={id}>{label}</FieldLabel><Input id={id} onChange={(event) => onChange(event.target.value)} {...props} /></Field>;
}

function StepNotice({ icon: Icon, title, description }: { icon: typeof Hospital; title: string; description: string }) {
  return <Alert><Icon aria-hidden="true" /><AlertTitle>{title}</AlertTitle><AlertDescription>{description}</AlertDescription></Alert>;
}

function WizardActions({ onBack, loading }: { onBack: () => void; loading: boolean }) {
  return <div className="flex justify-between gap-3"><Button type="button" variant="outline" onClick={onBack}><ArrowLeft data-icon="inline-start" />Atrás</Button><Button type="submit" disabled={loading}>{loading ? <Spinner data-icon="inline-start" /> : null}Siguiente<ArrowRight data-icon="inline-end" /></Button></div>;
}

function normalizeCatalogName(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function findCatalogAreaId(areaMap: Map<string, number>, areaName: string): number | undefined {
  const normalized = normalizeCatalogName(areaName);
  const direct = areaMap.get(normalized);
  if (direct) return direct;
  for (const [area, id] of areaMap) if (area.includes(normalized) || normalized.includes(area)) return id;
  const aliases: Record<string, string> = { consulta: 'consulta externa', imagenologia: 'radiologia', medicamentos: 'farmacia' };
  return aliases[normalized] ? areaMap.get(aliases[normalized]) : undefined;
}
