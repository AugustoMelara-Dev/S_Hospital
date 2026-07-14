import { useState, useEffect } from 'react';
import { Alert, Button, Input, Modal, Progress, Steps, Form, Space, Flex, Typography } from 'antd';
import { apiClient, userSafeErrorMessage } from '@/lib/api';
import { parseCents } from '@/lib/moneyCents';
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  FileDoneOutlined,
  MedicineBoxOutlined,
  UploadOutlined,
} from '@ant-design/icons';

const { TextArea } = Input;

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

export function SetupWizardDialog({ open, onOpenChange, onComplete }: SetupWizardDialogProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Hospital details
  const [hospitalForm, setHospitalForm] = useState({
    hospital_name: '',
    rtn: '',
    default_tax_rate: '15.00',
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
    `Categoría, Servicio, Precio, Grabado (S/N)\nConsulta, Consulta General, 250.00, N\nConsulta, Consulta Especialista, 600.00, N\nLaboratorio, Hemograma Completo, 180.00, S\nLaboratorio, Perfil Lipídico, 350.00, S\nImagenología, Radiografía Tórax AP, 450.00, N\nMedicamentos, Eritropoyetina 4000 UI, 25.00, N`
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

  // Parses CSV lines: Category, Area, Service, Price, Taxable.
  function parseCSV(text: string): Array<{ category: string; area: string; service: string; price: string; taxable: boolean }> {
    const lines = text.split('\n');
    const result: Array<{ category: string; area: string; service: string; price: string; taxable: boolean }> = [];

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

      if (category && area && service && parseCents(price) !== null) {
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
          throw new Error(`No existe el área "${item.area}". Revise el catálogo base antes de importar servicios.`);
        }

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
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      width={760}
      title={<Typography.Title level={3} className="m-0">Preparar caja</Typography.Title>}
      footer={null}
      destroyOnHidden
    >
      <Typography.Paragraph className="mb-6">
        Complete los datos mínimos para comenzar a facturar.
      </Typography.Paragraph>

      <Steps
        current={step - 1}
        size="small"
        className="mb-8"
        items={[
          { title: 'Hospital' },
          { title: 'Numeración' },
          { title: 'Catálogo' },
          { title: 'Finalizar' },
        ]}
      />

      <Space direction="vertical" size="large" className="w-full">
        {error && (
          <Alert type="error" showIcon title="No se pudo guardar" description={error} />
        )}

        {/* Step 1: Hospital details form */}
        {step === 1 && (
          <Form layout="vertical" onFinish={handleSaveHospital} className="w-full">
            <Alert
              type="info"
              showIcon
              icon={<MedicineBoxOutlined />}
              title={<Typography.Text strong>Paso 1: Datos del hospital</Typography.Text>}
              description="Estos datos aparecen en facturas, recibos y pantalla de ingreso."
              className="mb-6"
            />

            <Flex vertical gap="middle">
              <Form.Item label={<label htmlFor="wiz-hosp-name">Nombre del hospital *</label>} required>
                <Input
                  id="wiz-hosp-name"
                  value={hospitalForm.hospital_name}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, hospital_name: e.target.value })}
                  placeholder="Hospital General El Buen Pastor"
                  size="large"
                />
              </Form.Item>

              <Form.Item label={<label htmlFor="wiz-hosp-rtn">RTN *</label>} required>
                <Input
                  id="wiz-hosp-rtn"
                  value={hospitalForm.rtn}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, rtn: e.target.value })}
                  placeholder="0801-1990-123456"
                  size="large"
                />
              </Form.Item>

              <Form.Item label={<label htmlFor="wiz-hosp-tax">Impuesto general (%)</label>}>
                <Input
                  id="wiz-hosp-tax"
                  type="number"
                  step="0.01"
                  value={hospitalForm.default_tax_rate}
                  onChange={(e) => setHospitalForm({ ...hospitalForm, default_tax_rate: e.target.value })}
                  placeholder="15.00"
                  size="large"
                />
              </Form.Item>
            </Flex>

            <Flex justify="end" className="mt-6">
              <Button type="primary" htmlType="submit" disabled={loading} size="large" icon={<ArrowRightOutlined />} iconPosition="end">
                Siguiente
              </Button>
            </Flex>
          </Form>
        )}

        {/* Step 2: Fiscal sequence form */}
        {step === 2 && (
          <Form layout="vertical" onFinish={handleSaveSequence} className="w-full">
            <Alert
              type="info"
              showIcon
              icon={<FileDoneOutlined />}
              title={<Typography.Text strong>Paso 2: Numeración de facturas</Typography.Text>}
              description="Registre el CAI, prefijo y rango autorizado para imprimir facturas."
              className="mb-6"
            />

            <Flex vertical gap="middle">
              <Form.Item label={<label htmlFor="wiz-seq-prefix">Prefijo *</label>} required>
                <Input
                  id="wiz-seq-prefix"
                  value={sequenceForm.prefix}
                  onChange={(e) => setSequenceForm({ ...sequenceForm, prefix: e.target.value })}
                  placeholder="000-001-01"
                  size="large"
                />
              </Form.Item>

              <Form.Item label={<label htmlFor="wiz-seq-cai">CAI *</label>} required>
                <Input
                  id="wiz-seq-cai"
                  value={sequenceForm.cai}
                  onChange={(e) => setSequenceForm({ ...sequenceForm, cai: e.target.value.toUpperCase() })}
                  placeholder="4D82C1-30AAFF-8C4212-..."
                  size="large"
                />
              </Form.Item>

              <Form.Item label={<label htmlFor="wiz-seq-min">Desde el número *</label>} required>
                <Input
                  id="wiz-seq-min"
                  type="number"
                  value={sequenceForm.min_number}
                  onChange={(e) => setSequenceForm({ ...sequenceForm, min_number: parseInt(e.target.value) || 1 })}
                  size="large"
                />
              </Form.Item>

              <Form.Item label={<label htmlFor="wiz-seq-max">Hasta el número *</label>} required>
                <Input
                  id="wiz-seq-max"
                  type="number"
                  value={sequenceForm.max_number}
                  onChange={(e) => setSequenceForm({ ...sequenceForm, max_number: parseInt(e.target.value) || 99999999 })}
                  size="large"
                />
              </Form.Item>

              <Form.Item label={<label htmlFor="wiz-seq-date">Fecha límite *</label>} required>
                <Input
                  id="wiz-seq-date"
                  type="date"
                  value={sequenceForm.valid_until}
                  onChange={(e) => setSequenceForm({ ...sequenceForm, valid_until: e.target.value })}
                  size="large"
                />
              </Form.Item>
            </Flex>

            <Flex justify="space-between" className="mt-6">
              <Button onClick={() => setStep(1)} size="large" icon={<ArrowLeftOutlined />}>
                Atrás
              </Button>
              <Button type="primary" htmlType="submit" disabled={loading} size="large" icon={<ArrowRightOutlined />} iconPosition="end">
                Siguiente
              </Button>
            </Flex>
          </Form>
        )}

        {/* Step 3: Catalog Import form */}
        {step === 3 && (
          <Form layout="vertical" onFinish={handleImportCatalog} className="w-full">
            <Alert
              type="info"
              showIcon
              icon={<UploadOutlined />}
              title={<Typography.Text strong>Paso 3: Catálogo de servicios</Typography.Text>}
              description="Pegue la lista inicial de servicios. Luego podrá editarla desde Catálogo."
              className="mb-6"
            />

            <Form.Item
              label={
                <Flex justify="space-between" className="w-full">
                  <label htmlFor="wiz-cat-csv">Servicios: categoría, servicio, precio, impuesto</label>
                  <Typography.Text type="secondary" className="text-xs">Use S para impuesto o N para exento</Typography.Text>
                </Flex>
              }
              required
            >
              <TextArea
                id="wiz-cat-csv"
                rows={8}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                disabled={loading}
                className="font-mono text-xs"
              />
            </Form.Item>

            {importProgress && (
              <div className="border border-border p-4 bg-muted/40">
                <Flex justify="space-between" className="mb-2 font-semibold">
                  <Typography.Text>Importando servicios...</Typography.Text>
                  <Typography.Text>{importProgress.current} / {importProgress.total}</Typography.Text>
                </Flex>
                <Progress percent={Math.round((importProgress.current / importProgress.total) * 100)} status="active" />
              </div>
            )}

            <Flex justify="space-between" className="mt-6">
              <Button onClick={() => setStep(2)} size="large" icon={<ArrowLeftOutlined />} disabled={loading}>
                Atrás
              </Button>
              <Button type="primary" htmlType="submit" loading={loading} disabled={loading} size="large" icon={<ArrowRightOutlined />} iconPosition="end">
                {loading ? 'Procesando...' : 'Importar catálogo'}
              </Button>
            </Flex>
          </Form>
        )}

        {/* Step 4: Complete */}
        {step === 4 && (
          <Flex vertical align="center" gap="large" className="py-6 text-center">
            <CheckCircleOutlined className="text-6xl text-success" />

            <div>
              <Typography.Title level={3}>Configuración lista</Typography.Title>
              <Typography.Paragraph type="secondary" className="max-w-md">
                Ya puede iniciar la operación con datos del hospital, numeración y servicios base.
              </Typography.Paragraph>
            </div>

            <Flex vertical gap="small" className="w-full max-w-sm border border-border p-5 bg-muted/20 text-left">
              <Flex gap="small" align="center" className="text-success font-semibold text-xs">
                <CheckCircleOutlined />
                <span>Datos del hospital guardados</span>
              </Flex>
              <Flex gap="small" align="center" className="text-success font-semibold text-xs">
                <CheckCircleOutlined />
                <span>Numeración lista para facturar</span>
              </Flex>
              <Flex gap="small" align="center" className="text-success font-semibold text-xs">
                <CheckCircleOutlined />
                <span>Catálogo importado</span>
              </Flex>
            </Flex>

            <Button type="primary" onClick={handleFinish} size="large" className="px-8 mt-4">
              Entrar
            </Button>
          </Flex>
        )}
      </Space>
    </Modal>
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
    medicamentos: 'farmacia',
  };
  const alias = aliases[normalized];

  return alias ? areaMap.get(alias) : undefined;
}
