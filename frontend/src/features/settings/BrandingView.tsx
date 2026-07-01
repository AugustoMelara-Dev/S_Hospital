import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Save, UploadCloud } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTheme, COLOR_THEMES, type ColorTheme } from '@/hooks/useTheme';
import { type FiscalSettings, apiClient, userSafeErrorMessage } from '@/lib/api';
import { safeClientMessage } from '@/lib/support/clientIssueLog';

type BrandingViewProps = {
  canEdit: boolean;
  onStatus: (message: string) => void;
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
    onStatus('Guardando color de marca...');
    try {
      const updated = await apiClient.updateFiscalSettings({
        hospital_name: settings.hospital_name ?? '',
        rtn: settings.rtn ?? '',
        default_tax_rate: settings.default_tax_rate ?? '15.00',
        primary_color: newColor,
        address: settings.address ?? '',
        slogan: settings.slogan ?? '',
        scanner_enabled: settings.scanner_enabled === true,
        partial_payments_enabled: settings.partial_payments_enabled === true,
        receipt_template_mode: 'institutional',
        receipt_paper_size: settings.receipt_paper_size ?? 'half_letter',
      });
      setSettings(updated);
      onStatus(`Color de marca cambiado a ${COLOR_THEMES[newColor].name}.`);
    } catch (err) {
      const message = safeClientMessage(userSafeErrorMessage(err, 'No se pudo guardar el color.'));
      onStatus(message);
    } finally {
      savingRef.current = false;
    }
  }

  async function handleUploadLogo() {
    if (!logoFile || uploadingRef.current) return;
    uploadingRef.current = true;
    setUploading(true);
    setError('');
    onStatus('Subiendo logo institucional...');
    try {
      const url = await apiClient.uploadLogo(logoFile);
      setLogoUrl(url);
      onStatus('Logo institucional actualizado.');
      setLogoFile(null);
    } catch (err) {
      const message = safeClientMessage(userSafeErrorMessage(err, 'No se pudo subir el logo.'));
      setError(message);
      onStatus(message);
    } finally {
      uploadingRef.current = false;
      setUploading(false);
    }
  }

  return (
    <FormSection
      title="Marca institucional"
      description="Logo y color de la marca. Visible en encabezados y botones."
    >
      {error ? (
        <Alert variant="destructive" title="No se pudo guardar">
          {error}
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Logo institucional</CardTitle>
            <CardDescription>Aparece en recibos y cabecera de la app.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center justify-center rounded-panel border-2 border-dashed border-operational-border bg-operational-panel p-6">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo institucional"
                  className="max-h-24 rounded border border-border bg-white object-contain p-2"
                />
              ) : (
                <div className="flex flex-col items-center text-muted-foreground">
                  <UploadCloud aria-hidden="true" className="size-10" />
                  <span className="mt-2 text-xs">Sin logo cargado.</span>
                </div>
              )}
            </div>
            {canEdit && (
              <div className="space-y-2">
                <Label htmlFor="logo-input">Seleccionar imagen (.png, .jpg)</Label>
                <Input
                  id="logo-input"
                  type="file"
                  accept="image/png, image/jpeg, image/jpg"
                  disabled={uploading}
                  onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                />
                {logoFile && (
                  <Button type="button" onClick={handleUploadLogo} disabled={uploading} className="w-full gap-2">
                    <Save data-icon aria-hidden="true" />
                    {uploading ? 'Subiendo...' : 'Subir logo'}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Color de marca</CardTitle>
            <CardDescription>Aplica a botones, acentos y estados activos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(Object.keys(COLOR_THEMES) as ColorTheme[]).map((themeKey) => {
              const themeObj = COLOR_THEMES[themeKey];
              const active = colorTheme === themeKey;
              return (
                <Button
                  key={themeKey}
                  type="button"
                  variant={active ? 'secondary' : 'outline'}
                  onClick={() => handleSaveColor(themeKey)}
                  disabled={!canEdit}
                  className="h-auto w-full justify-between p-3 text-left"
                >
                  <span className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="size-5 rounded-full border border-black/10"
                      style={{ backgroundColor: themeObj.light.secondary }}
                    />
                    <span className="text-sm">{themeObj.name}</span>
                  </span>
                  {active ? <Check aria-hidden="true" className="size-4 text-secondary shrink-0" /> : null}
                </Button>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </FormSection>
  );
}
