import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckOutlined as Check, SaveOutlined as Save } from '@ant-design/icons';
import { Alert, Button, Card, ColorPicker, Input, Typography } from 'antd';
import { useTheme, COLOR_THEMES, type ColorTheme } from '@/hooks/useTheme';
import { type FiscalSettings, apiClient, userSafeErrorMessage } from '@/lib/api';
import { safeClientMessage } from '@/lib/support/clientIssueLog';
import type { OperationalStatusReporter } from '@/app/operationalStatus';
import { InstitutionalIdentity } from '@/design-system';
import { displayHospitalName } from '@/lib/hospital-name';

type BrandingViewProps = {
  canEdit: boolean;
  onStatus: OperationalStatusReporter;
};

export function BrandingView({ canEdit, onStatus }: BrandingViewProps) {
  const { colorTheme, setColorTheme } = useTheme();
  const [settings, setSettings] = useState<FiscalSettings | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);
  const uploadingRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const [data, url] = await Promise.all([
        apiClient.getFiscalSettings(),
        apiClient.getLogo().catch(() => null),
      ]);
      setSettings(data);
      setLogoUrl(url);
      if (data?.primary_color) {
        setColorTheme(data.primary_color as ColorTheme);
      }
    } catch (err) {
      const message = safeClientMessage(userSafeErrorMessage(err, 'No se pudo cargar la marca.'));
      setError(message);
    }
  }, [setColorTheme]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSaveColor(newColor: ColorTheme) {
    if (!canEdit || !settings) return;
    setColorTheme(newColor);
    savingRef.current = true;
    onStatus({
      key: 'settings:branding:color',
      level: 'info',
      message: 'Guardando color de marca...',
      toast: false,
    });
    try {
      const updated = await apiClient.updateFiscalSettings({
        primary_color: newColor,
      });
      setSettings(updated);
      onStatus({
        key: 'settings:branding:color',
        level: 'success',
        message: `Color de marca cambiado a ${COLOR_THEMES[newColor].name}.`,
      });
    } catch (err) {
      const message = safeClientMessage(userSafeErrorMessage(err, 'No se pudo guardar el color.'));
      onStatus({ key: 'settings:branding:color', level: 'error', message });
    } finally {
      savingRef.current = false;
    }
  }

  async function handleUploadLogo() {
    if (!logoFile || uploadingRef.current) return;
    uploadingRef.current = true;
    setUploading(true);
    setError('');
    onStatus({
      key: 'settings:branding:logo',
      level: 'info',
      message: 'Subiendo logo institucional...',
      toast: false,
    });
    try {
      const url = await apiClient.uploadLogo(logoFile);
      setLogoUrl(url);
      onStatus({
        key: 'settings:branding:logo',
        level: 'success',
        message: 'Logo institucional actualizado.',
      });
      setLogoFile(null);
    } catch (err) {
      const message = safeClientMessage(userSafeErrorMessage(err, 'No se pudo subir el logo.'));
      setError(message);
      onStatus({ key: 'settings:branding:logo', level: 'error', message });
    } finally {
      uploadingRef.current = false;
      setUploading(false);
    }
  }

  return (
    <section>
      <Typography.Title level={3}>Marca institucional</Typography.Title>
      <Typography.Paragraph type="secondary">Logo y color de la marca. Visible en encabezados y botones.</Typography.Paragraph>
      {error ? (
        <Alert type="error" showIcon title="No se pudo guardar" description={error} />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Logo institucional" extra={<Typography.Text type="secondary">Aparece en recibos y cabecera de la app.</Typography.Text>}>
          <div className="space-y-4">
            <div className="border border-operational-border bg-muted/40 p-5">
              <InstitutionalIdentity
                hospitalName={displayHospitalName(settings?.hospital_name)}
                location={settings?.receipt_location?.trim() || 'Tocoa, Colón, Honduras'}
                logoUrl={logoUrl}
              />
              {!logoUrl ? (
                <Typography.Paragraph type="secondary" className="mb-0 mt-4 text-xs">
                  Se usa un wordmark tipográfico provisional. Reemplácelo aquí cuando el hospital entregue un SVG o PNG oficial autorizado.
                </Typography.Paragraph>
              ) : null}
            </div>
            {canEdit && (
              <div className="space-y-2">
                <label htmlFor="logo-input">Seleccionar imagen (.png, .jpg)</label>
                <Input
                  id="logo-input"
                  type="file"
                  accept="image/png, image/jpeg, image/jpg"
                  disabled={uploading}
                  onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                />
                {logoFile && (
                  <Button htmlType="button" type="primary" icon={<Save aria-hidden="true" />} onClick={handleUploadLogo} disabled={uploading} className="w-full gap-2">
                    {uploading ? 'Subiendo...' : 'Subir logo'}
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card>

        <Card title="Color de marca" extra={<Typography.Text type="secondary">Aplica a botones, acentos y estados activos.</Typography.Text>}>
          <div className="space-y-3">
            {(Object.keys(COLOR_THEMES) as ColorTheme[]).map((themeKey) => {
              const themeObj = COLOR_THEMES[themeKey];
              const active = colorTheme === themeKey;
              return (
                <Button
                  key={themeKey}
                  htmlType="button"
                  type={active ? 'primary' : 'default'}
                  onClick={() => handleSaveColor(themeKey)}
                  disabled={!canEdit}
                  className="h-auto w-full justify-between p-3 text-left"
                >
                  <span className="flex items-center gap-3">
                    <ColorPicker aria-hidden="true" value={themeObj.light.secondary} disabled size="small" />
                    <span className="text-sm">{themeObj.name}</span>
                  </span>
                  {active ? <Check aria-hidden="true" className="size-4 text-secondary shrink-0" /> : null}
                </Button>
              );
            })}
          </div>
        </Card>
      </div>
    </section>
  );
}
