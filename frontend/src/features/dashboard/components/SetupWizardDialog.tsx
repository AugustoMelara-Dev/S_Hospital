import { useState, useEffect } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
import { apiClient, userSafeErrorMessage } from '@/lib/api';
import { INSTITUTIONAL_RECEIPT_PAPER_OPTIONS, type InstitutionalReceiptPaperOption, institutionalReceiptPaperSize } from '@/lib/institutionalReceiptPaper';
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

type InstitutionalReceiptPaperSize = InstitutionalReceiptPaperOption;

function institutionalPaperSize(value: unknown): InstitutionalReceiptPaperSize {
  return institutionalReceiptPaperSize(typeof value === 'string' ? value : undefined);
}

export function SetupWizardDialog({ open, onOpenChange, onComplete }: SetupWizardDialogProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Hospital details
  const [hospitalForm, setHospitalForm] = useState({
    hospital_name: '',
    rtn: '',
    default_tax_rate: '15.00',
    receipt_paper_size: 'half_letter' as InstitutionalReceiptPaperSize,
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
          receipt_paper_size: institutionalPaperSize(settings.receipt_paper_size),
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
        receipt_paper_size: hospitalForm.receipt_paper_size,
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

  // Parses CSV lines: Category, Area, Service, Price, Taxable. Old four-column CSVs use category as area.
  function parseCSV(text: string): Array<{ category: string; area: string; service: string; price: string; taxable: boolean }> {
    const lines = text.split('\n');
    const result: Array<{ category: string; area: string; service: string; price: string; taxable: boolean }> = [];
    
    // Skip header line if it looks like one
    const startIdx = lines[0].toLowerCase().includes('categor') ? 1 : 0;

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(',').map((p) => p.trim());
      if (parts.length < 3) continue;

      const hasAreaColumn = parts.length >= 5;
      const category = parts[0];
      const area = hasAreaColumn ? parts[1] : parts[0];
      const service = hasAreaColumn ? parts[2] : parts[1];
      const price = hasAreaColumn ? parts[3] : parts[2];
      const taxableInput = hasAreaColumn ? parts[4] : parts[3];
      const taxableChar = taxableInput ? taxableInput.toUpperCase() : 'S';
      const taxable = taxableChar === 'S' || taxableChar === 'SI' || taxableChar === 'Y' || taxableChar === 'YES' || taxableChar === '1';

      if (category && area && service && !isNaN(parseFloat(price))) {
        result.push({ category, area, service, price, taxable });
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
      // First, get existing categories and active areas for accountable reporting.
      const [existingCats, existingAreas] = await Promise.all([
        apiClient.getCategories(),
        apiClient.getAreas(true),
      ]);
      const catMap = new Map(existingCats.map((c) => [c.name.toLowerCase(), c.id]));
      const areaMap = new Map(existingAreas.map((area) => [normalizeCatalogName(area.name), area.id]));

      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        setImportProgress({ current: i + 1, total: parsed.length });
        const areaId = findCatalogAreaId(areaMap, item.area);

        if (!areaId) {
          throw new Error(`No existe el area "${item.area}". Revise el catalogo base antes de importar servicios.`);
        }

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
          area_id: areaId,
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
      title="Preparar caja"
      description="Complete los datos minimos para comenzar a facturar."
    >
      <div className="space-y-6 py-2">
        {/* Step Indicators */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-6">
            <div className={`flex items-center gap-2 text-xs font-semibold ${step >= 1 ? 'text-secondary' : 'text-muted-foreground'}`}>
              <span className={`flex size-6 items-center justify-center rounded-full text-[10px] ${step === 1 ? 'bg-secondary text-secondary-foreground animate-pulse' : step > 1 ? 'bg-secondary/10 text-secondary' : 'bg-muted'}`}>1</span>
              <span>Hospital</span>
            </div>
            <div className="h-px w-8 bg-border" />
            <div className={`flex items-center gap-2 text-xs font-semibold ${step >= 2 ? 'text-secondary' : 'text-muted-foreground'}`}>
              <span className={`flex size-6 items-center justify-center rounded-full text-[10px] ${step === 2 ? 'bg-secondary text-secondary-foreground animate-pulse' : step > 2 ? 'bg-secondary/10 text-secondary' : 'bg-muted'}`}>2</span>
              <span>Numeracion</span>
            </div>
            <div className="h-px w-8 bg-border" />
            <div className={`flex items-center gap-2 text-xs font-semibold ${step >= 3 ? 'text-secondary' : 'text-muted-foreground'}`}>
              <span className={`flex size-6 items-center justify-center rounded-full text-[10px] ${step === 3 ? 'bg-secondary text-secondary-foreground animate-pulse' : step > 3 ? 'bg-secondary/10 text-secondary' : 'bg-muted'}`}>3</span>
              <span>Catalogo</span>
            </div>
            <div className="h-px w-8 bg-border" />
            <div className={`flex items-center gap-2 text-xs font-semibold ${step >= 4 ? 'text-secondary' : 'text-muted-foreground'}`}>
              <span className={`flex size-6 items-center justify-center rounded-full text-[10px] ${step === 4 ? 'bg-secondary text-secondary-foreground' : 'bg-muted'}`}>4</span>
              <span>Finalizar</span>
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" title="No se pudo guardar">
            {error}
          </Alert>
        )}

        {/* Step 1: Hospital details form */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex gap-4 p-4 rounded-lg bg-accent border border-secondary/10">
              <Building2 className="size-10 text-secondary shrink-0" />
              <div>
                <h4 className="font-semibold text-foreground text-sm">Paso 1: Datos del hospital</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Estos datos aparecen en facturas, recibos y pantalla de ingreso.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="wiz-hosp-name">Nombre del hospital *</Label>
                <Input
                  id="wiz-hosp-name"
                  value={hospitalForm.hospital_name}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, hospital_name: e.target.value })}
                  placeholder="Hospital General El Buen Pastor"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wiz-hosp-rtn">RTN *</Label>
                <Input
                  id="wiz-hosp-rtn"
                  value={hospitalForm.rtn}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, rtn: e.target.value })}
                  placeholder="0801-1990-123456"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wiz-hosp-tax">Impuesto general (%)</Label>
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
                <Label htmlFor="wiz-hosp-width">Tamano del recibo institucional</Label>
                <Select
                  value={hospitalForm.receipt_paper_size}
                  onValueChange={(val: string) => setHospitalForm({ ...hospitalForm, receipt_paper_size: val as InstitutionalReceiptPaperSize })}
                >
                  <SelectTrigger id="wiz-hosp-width">
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
            <div className="flex gap-4 p-4 rounded-lg bg-accent border border-secondary/10">
              <FileCheck className="size-10 text-secondary shrink-0" />
              <div>
                <h4 className="font-semibold text-foreground text-sm">Paso 2: Numeracion de facturas</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Registre el CAI, prefijo y rango autorizado para imprimir facturas.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="wiz-seq-prefix">Prefijo *</Label>
                <Input
                  id="wiz-seq-prefix"
                  value={sequenceForm.prefix}
                  onChange={(e) => setSequenceForm({ ...sequenceForm, prefix: e.target.value })}
                  placeholder="000-001-01"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wiz-seq-cai">CAI *</Label>
                <Input
                  id="wiz-seq-cai"
                  value={sequenceForm.cai}
                  onChange={(e) => setSequenceForm({ ...sequenceForm, cai: e.target.value.toUpperCase() })}
                  placeholder="4D82C1-30AAFF-8C4212-..."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wiz-seq-min">Desde el numero *</Label>
                <Input
                  id="wiz-seq-min"
                  type="number"
                  value={sequenceForm.min_number}
                  onChange={(e) => setSequenceForm({ ...sequenceForm, min_number: parseInt(e.target.value) || 1 })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wiz-seq-max">Hasta el numero *</Label>
                <Input
                  id="wiz-seq-max"
                  type="number"
                  value={sequenceForm.max_number}
                  onChange={(e) => setSequenceForm({ ...sequenceForm, max_number: parseInt(e.target.value) || 99999999 })}
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="wiz-seq-date">Fecha limite *</Label>
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
                Atras
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
            <div className="flex gap-4 p-4 rounded-lg bg-accent border border-secondary/10">
              <PackagePlus className="size-10 text-secondary shrink-0" />
              <div>
                <h4 className="font-semibold text-foreground text-sm">Paso 3: Catalogo de servicios</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pegue la lista inicial de servicios. Luego podra editarla desde Catalogo.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="wiz-cat-csv">Servicios: categoria, servicio, precio, impuesto</Label>
                <span className="text-[10px] text-muted-foreground">Use S para impuesto o N para exento</span>
              </div>
              <Textarea
                id="wiz-cat-csv"
                className="h-44 bg-card text-xs"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                disabled={loading}
              />
            </div>

            {importProgress && (
              <div className="space-y-1 bg-muted p-3 rounded border border-border">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Importando servicios...</span>
                  <span>{importProgress.current} / {importProgress.total}</span>
                </div>
                <div className="h-2 w-full bg-background rounded-full overflow-hidden">
                  <div
                    className="h-full bg-secondary transition-all duration-200"
                    style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button type="button" variant="secondary" onClick={() => setStep(2)} className="gap-2" disabled={loading}>
                <ArrowLeft className="size-4" />
                Atras
              </Button>
              <Button onClick={handleImportCatalog} disabled={loading} className="gap-2">
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    Importar catalogo
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
              <CheckCircle className="size-16 text-success fill-success/15 animate-bounce" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-foreground">Configuracion lista</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Ya puede iniciar la operacion con datos del hospital, numeracion y servicios base.
              </p>
            </div>

            <div className="rounded-lg border border-border p-4 max-w-sm mx-auto text-left space-y-3 bg-muted/50">
              <div className="flex items-center gap-2.5 text-xs text-success font-semibold">
                <span className="flex size-4 items-center justify-center rounded-full bg-success/15 text-[10px]">✓</span>
                <span>Datos del hospital guardados</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-success font-semibold">
                <span className="flex size-4 items-center justify-center rounded-full bg-success/15 text-[10px]">✓</span>
                <span>Numeracion lista para facturar</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-success font-semibold">
                <span className="flex size-4 items-center justify-center rounded-full bg-success/15 text-[10px]">✓</span>
                <span>Catalogo importado</span>
              </div>
            </div>

            <div className="flex justify-center pt-4">
              <Button onClick={handleFinish} className="px-8">
                Entrar
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

function normalizeCatalogName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function findCatalogAreaId(areaMap: Map<string, number>, areaName: string): number | undefined {
  const normalized = normalizeCatalogName(areaName);
  const direct = areaMap.get(normalized);

  if (direct) {
    return direct;
  }

  for (const [area, id] of areaMap) {
    if (area.includes(normalized) || normalized.includes(area)) {
      return id;
    }
  }

  const aliases: Record<string, string> = {
    consulta: 'consulta externa',
    imagenologia: 'radiologia',
    hospitalizacion: 'hospitalizacion y emergencia',
  };
  const alias = aliases[normalized];

  return alias ? areaMap.get(alias) : undefined;
}
