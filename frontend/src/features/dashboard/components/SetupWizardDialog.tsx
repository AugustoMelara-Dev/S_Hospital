import { useState, useEffect } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
import { apiClient, userSafeErrorMessage } from '@/lib/api';
import {
  Building2,
  FileCheck,
  PackagePlus,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Loader2,
} from 'lucide-react';

type SetupWizardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
};

export function SetupWizardDialog({ open, onOpenChange, onComplete }: SetupWizardDialogProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Hospital details
  const [hospitalForm, setHospitalForm] = useState({
    hospital_name: '',
    rtn: '',
    default_tax_rate: '15.00',
    receipt_width: '80mm' as '80mm' | '58mm',
    primary_color: 'indigo' as 'teal' | 'blue' | 'indigo' | 'green' | 'rose',
    address: '',
    slogan: '',
  });

  // Step 2: Fiscal sequence
  const [sequenceForm, setSequenceForm] = useState({
    prefix: '000-001-01',
    cai: '',
    min_number: 1,
    max_number: 99999999,
    valid_until: '',
  });

  // Step 3: Catalog CSV
  const [csvText, setCsvText] = useState(
    `Categoría, Servicio, Precio, Grabado (S/N)\nConsulta, Consulta General, 250.00, N\nConsulta, Consulta Especialista, 600.00, N\nLaboratorio, Hemograma Completo, 180.00, S\nLaboratorio, Perfil Lipídico, 350.00, S\nImagenología, Radiografía Tórax AP, 450.00, N\nHospitalización, Eritropoyetina 4000 UI, 25.00, N`
  );
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);

  // Load existing configuration if any
  useEffect(() => {
    if (open) {
      void loadExistingSetup();
    }
  }, [open]);

  async function loadExistingSetup() {
    try {
      const [settings, sequences] = await Promise.all([
        apiClient.getFiscalSettings(),
        apiClient.getFiscalSequences(),
      ]);

      if (settings) {
        setHospitalForm({
          hospital_name: settings.hospital_name || '',
          rtn: settings.rtn || '',
          default_tax_rate: settings.default_tax_rate || '15.00',
          receipt_width: (settings.receipt_width as '80mm' | '58mm') || '80mm',
          primary_color: settings.primary_color || 'indigo',
          address: settings.address || '',
          slogan: settings.slogan || '',
        });
      }

      if (sequences && sequences.length > 0) {
        const seq = sequences[0];
        setSequenceForm({
          prefix: seq.prefix || '000-001-01',
          cai: seq.cai || '',
          min_number: seq.min_number || 1,
          max_number: seq.max_number || 99999999,
          valid_until: seq.valid_until || '',
        });
      }
    } catch {
      // Silently fall back to defaults
    }
  }

  // Handle Step 1 Save
  async function handleSaveHospital() {
    if (!hospitalForm.hospital_name.trim()) {
      setError('El nombre del hospital es obligatorio.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await apiClient.updateFiscalSettings({
        hospital_name: hospitalForm.hospital_name,
        rtn: hospitalForm.rtn,
        default_tax_rate: hospitalForm.default_tax_rate,
        receipt_width: hospitalForm.receipt_width,
        primary_color: hospitalForm.primary_color,
        address: hospitalForm.address,
        slogan: hospitalForm.slogan,
      });
      setStep(2);
    } catch (err) {
      setError(userSafeErrorMessage(err, 'No se pudo guardar la configuración del hospital.'));
    } finally {
      setLoading(false);
    }
  }

  // Handle Step 2 Save
  async function handleSaveSequence() {
    if (!sequenceForm.prefix.trim() || !sequenceForm.cai.trim() || !sequenceForm.valid_until) {
      setError('El prefijo, CAI y la fecha límite de emisión son obligatorios.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await apiClient.saveFiscalSequence({
        document_type: 'invoice',
        prefix: sequenceForm.prefix,
        cai: sequenceForm.cai,
        min_number: sequenceForm.min_number,
        max_number: sequenceForm.max_number,
        current_number: 0,
        valid_until: sequenceForm.valid_until,
        active: true,
      });
      setStep(3);
    } catch (err) {
      setError(userSafeErrorMessage(err, 'No se pudo guardar la secuencia fiscal.'));
    } finally {
      setLoading(false);
    }
  }

  // Parses CSV lines: Category, Service, Price, Taxable
  function parseCSV(text: string): Array<{ category: string; service: string; price: string; taxable: boolean }> {
    const lines = text.split('\n');
    const result: Array<{ category: string; service: string; price: string; taxable: boolean }> = [];
    
    // Skip header line if it looks like one
    const startIdx = lines[0].toLowerCase().includes('categor') ? 1 : 0;

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(',').map((p) => p.trim());
      if (parts.length < 3) continue;

      const category = parts[0];
      const service = parts[1];
      const price = parts[2];
      const taxableChar = parts[3] ? parts[3].toUpperCase() : 'S';
      const taxable = taxableChar === 'S' || taxableChar === 'SI' || taxableChar === 'Y' || taxableChar === 'YES' || taxableChar === '1';

      if (category && service && !isNaN(parseFloat(price))) {
        result.push({ category, service, price, taxable });
      }
    }
    return result;
  }

  // Handle CSV Import
  async function handleImportCatalog() {
    const parsed = parseCSV(csvText);
    if (parsed.length === 0) {
      setError('No se encontraron servicios válidos en el formato CSV provisto.');
      return;
    }

    setLoading(true);
    setError('');
    setImportProgress({ current: 0, total: parsed.length });

    try {
      // First, get existing categories or make a set of categories to create
      const existingCats = await apiClient.getCategories();
      const catMap = new Map(existingCats.map((c) => [c.name.toLowerCase(), c.id]));

      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        setImportProgress({ current: i + 1, total: parsed.length });

        // Ensure category exists
        let categoryId = catMap.get(item.category.toLowerCase());
        if (!categoryId) {
          const newCat = await apiClient.saveCategory({
            name: item.category,
            active: true,
            sort_order: existingCats.length + 10,
          });
          categoryId = newCat.id;
          catMap.set(item.category.toLowerCase(), categoryId);
        }

        // Create service
        await apiClient.saveService({
          category_id: categoryId,
          name: item.service,
          price: item.price,
          taxable: item.taxable,
          active: true,
          scan_code: null,
          barcode: null,
          qr_code: null,
          special_rule_code: null,
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

  const handleFinish = () => {
    onComplete();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Asistente de Configuración Inicial"
      description="Ponga en marcha el sistema hospitalario S_Hospital completando estos pasos fundamentales."
    >
      <div className="space-y-6 py-2">
        {/* Step Indicators */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-6">
            <div className={`flex items-center gap-2 text-xs font-semibold ${step >= 1 ? 'text-teal-600' : 'text-muted-foreground'}`}>
              <span className={`flex size-6 items-center justify-center rounded-full text-[10px] ${step === 1 ? 'bg-teal-600 text-white animate-pulse' : step > 1 ? 'bg-teal-100 text-teal-700' : 'bg-muted'}`}>1</span>
              <span>Datos Hospital</span>
            </div>
            <div className="h-px w-8 bg-border" />
            <div className={`flex items-center gap-2 text-xs font-semibold ${step >= 2 ? 'text-teal-600' : 'text-muted-foreground'}`}>
              <span className={`flex size-6 items-center justify-center rounded-full text-[10px] ${step === 2 ? 'bg-teal-600 text-white animate-pulse' : step > 2 ? 'bg-teal-100 text-teal-700' : 'bg-muted'}`}>2</span>
              <span>Rango Fiscal</span>
            </div>
            <div className="h-px w-8 bg-border" />
            <div className={`flex items-center gap-2 text-xs font-semibold ${step >= 3 ? 'text-teal-600' : 'text-muted-foreground'}`}>
              <span className={`flex size-6 items-center justify-center rounded-full text-[10px] ${step === 3 ? 'bg-teal-600 text-white animate-pulse' : step > 3 ? 'bg-teal-100 text-teal-700' : 'bg-muted'}`}>3</span>
              <span>Catálogo</span>
            </div>
            <div className="h-px w-8 bg-border" />
            <div className={`flex items-center gap-2 text-xs font-semibold ${step >= 4 ? 'text-teal-600' : 'text-muted-foreground'}`}>
              <span className={`flex size-6 items-center justify-center rounded-full text-[10px] ${step === 4 ? 'bg-teal-600 text-white' : 'bg-muted'}`}>4</span>
              <span>Finalizar</span>
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" title="Error de configuración">
            {error}
          </Alert>
        )}

        {/* Step 1: Hospital details form */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex gap-4 p-4 rounded-lg bg-teal-50/50 dark:bg-slate-900 border border-teal-500/10">
              <Building2 className="size-10 text-teal-600 shrink-0" />
              <div>
                <h4 className="font-semibold text-foreground text-sm">Paso 1: Información Legal de la Institución</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ingrese la denominación comercial y el RTN autorizado. Esta información se incrustará de forma obligatoria en la cabecera de las facturas impresas.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="wiz-hosp-name">Nombre del Hospital / Clínica *</Label>
                <Input
                  id="wiz-hosp-name"
                  value={hospitalForm.hospital_name}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, hospital_name: e.target.value })}
                  placeholder="Hospital General El Buen Pastor"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wiz-hosp-rtn">RTN del Hospital *</Label>
                <Input
                  id="wiz-hosp-rtn"
                  value={hospitalForm.rtn}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, rtn: e.target.value })}
                  placeholder="0801-1990-123456"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wiz-hosp-tax">Tasa de Impuesto General (%)</Label>
                <Input
                  id="wiz-hosp-tax"
                  type="number"
                  step="0.01"
                  value={hospitalForm.default_tax_rate}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, default_tax_rate: e.target.value })}
                  placeholder="15.00"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wiz-hosp-width">Papel Impresora Térmica por Defecto</Label>
                <Select
                  value={hospitalForm.receipt_width}
                  onValueChange={(val: '80mm' | '58mm') => setHospitalForm({ ...hospitalForm, receipt_width: val })}
                >
                  <SelectTrigger id="wiz-hosp-width">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="80mm">80mm (Estándar de hospital)</SelectItem>
                    <SelectItem value="58mm">58mm (Formatos pequeños)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={handleSaveHospital} disabled={loading} className="gap-2">
                Siguiente
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Fiscal sequence form */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex gap-4 p-4 rounded-lg bg-teal-50/50 dark:bg-slate-900 border border-teal-500/10">
              <FileCheck className="size-10 text-teal-600 shrink-0" />
              <div>
                <h4 className="font-semibold text-foreground text-sm">Paso 2: Rango Fiscal Autorizado (CAI)</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Establezca el CAI único y el prefijo de numeración tributaria asignado por la autoridad fiscal para facturación física.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="wiz-seq-prefix">Prefijo / Punto Emisión *</Label>
                <Input
                  id="wiz-seq-prefix"
                  value={sequenceForm.prefix}
                  onChange={(e) => setSequenceForm({ ...sequenceForm, prefix: e.target.value })}
                  placeholder="000-001-01"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wiz-seq-cai">Código de Autorización CAI *</Label>
                <Input
                  id="wiz-seq-cai"
                  value={sequenceForm.cai}
                  onChange={(e) => setSequenceForm({ ...sequenceForm, cai: e.target.value.toUpperCase() })}
                  placeholder="4D82C1-30AAFF-8C4212-..."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wiz-seq-min">Desde el número *</Label>
                <Input
                  id="wiz-seq-min"
                  type="number"
                  value={sequenceForm.min_number}
                  onChange={(e) => setSequenceForm({ ...sequenceForm, min_number: parseInt(e.target.value) || 1 })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wiz-seq-max">Hasta el número *</Label>
                <Input
                  id="wiz-seq-max"
                  type="number"
                  value={sequenceForm.max_number}
                  onChange={(e) => setSequenceForm({ ...sequenceForm, max_number: parseInt(e.target.value) || 99999999 })}
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="wiz-seq-date">Fecha Límite de Emisión *</Label>
                <Input
                  id="wiz-seq-date"
                  type="date"
                  value={sequenceForm.valid_until}
                  onChange={(e) => setSequenceForm({ ...sequenceForm, valid_until: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button type="button" variant="secondary" onClick={() => setStep(1)} className="gap-2">
                <ArrowLeft className="size-4" />
                Atrás
              </Button>
              <Button onClick={handleSaveSequence} disabled={loading} className="gap-2">
                Siguiente
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Catalog Import form */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex gap-4 p-4 rounded-lg bg-teal-50/50 dark:bg-slate-900 border border-teal-500/10">
              <PackagePlus className="size-10 text-teal-600 shrink-0" />
              <div>
                <h4 className="font-semibold text-foreground text-sm">Paso 3: Carga del Catálogo de Servicios</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Importe masivamente su portafolio de servicios médicos inicial. Edite la plantilla de muestra abajo o copie y pegue su propio archivo de Excel/CSV.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="wiz-cat-csv">Listado de Servicios (Formato: Categoría, Servicio, Precio, Grabado)</Label>
                <span className="text-[10px] text-muted-foreground">Grabado = S (Sí) o N (No / Exento)</span>
              </div>
              <textarea
                id="wiz-cat-csv"
                className="w-full h-44 rounded-md border border-input bg-card p-3 font-mono text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                disabled={loading}
              />
            </div>

            {importProgress && (
              <div className="space-y-1 bg-slate-100 dark:bg-slate-800 p-3 rounded border border-border">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Importando registros del catálogo...</span>
                  <span>{importProgress.current} / {importProgress.total}</span>
                </div>
                <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-600 transition-all duration-200"
                    style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button type="button" variant="secondary" onClick={() => setStep(2)} className="gap-2" disabled={loading}>
                <ArrowLeft className="size-4" />
                Atrás
              </Button>
              <Button onClick={handleImportCatalog} disabled={loading} className="gap-2">
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    Importar Catálogo
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 4 && (
          <div className="space-y-6 text-center py-6">
            <div className="flex justify-center">
              <CheckCircle className="size-16 text-emerald-500 fill-emerald-100 dark:fill-emerald-950/30 animate-bounce" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-foreground">¡Configuración Inicial Completada!</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                El sistema ha sido configurado con los datos de su hospital, secuencias fiscales válidas y portafolio de servicios médicos base.
              </p>
            </div>

            <div className="rounded-lg border border-border p-4 max-w-sm mx-auto text-left space-y-3 bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center gap-2.5 text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                <span className="flex size-4 items-center justify-center rounded-full bg-emerald-100 text-[10px]">✓</span>
                <span>Datos fiscales validados</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                <span className="flex size-4 items-center justify-center rounded-full bg-emerald-100 text-[10px]">✓</span>
                <span>Secuencia y prefijo listos para facturación</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                <span className="flex size-4 items-center justify-center rounded-full bg-emerald-100 text-[10px]">✓</span>
                <span>Catálogo de servicios importado</span>
              </div>
            </div>

            <div className="flex justify-center pt-4">
              <Button onClick={handleFinish} className="px-8 bg-teal-600 hover:bg-teal-700">
                Entrar al Sistema
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
