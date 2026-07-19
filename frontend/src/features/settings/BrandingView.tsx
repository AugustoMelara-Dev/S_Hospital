import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Save, TriangleAlert } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import type { OperationalStatusReporter } from '@/app/operationalStatus';
import { InstitutionalIdentity } from '@/design-system';
import { useTheme, COLOR_THEMES, type ColorTheme } from '@/hooks/useTheme';
import { type FiscalSettings, apiClient, userSafeErrorMessage } from '@/lib/api';
import { displayHospitalName } from '@/lib/hospital-name';
import { safeClientMessage } from '@/lib/support/clientIssueLog';

type BrandingViewProps = { canEdit: boolean; onStatus: OperationalStatusReporter };

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
      const [data, url] = await Promise.all([apiClient.getFiscalSettings(), apiClient.getLogo().catch(() => null)]);
      setSettings(data);
      setLogoUrl(url);
      if (data?.primary_color) setColorTheme(data.primary_color as ColorTheme);
    } catch (err) {
      setError(safeClientMessage(userSafeErrorMessage(err, 'No se pudo cargar la marca.')));
    }
  }, [setColorTheme]);

  useEffect(() => { void load(); }, [load]);

  async function handleSaveColor(newColor: ColorTheme) {
    if (!canEdit || !settings || savingRef.current) return;
    setColorTheme(newColor);
    savingRef.current = true;
    onStatus({ key: 'settings:branding:color', level: 'info', message: 'Guardando color de marca...', toast: false });
    try {
      const updated = await apiClient.updateFiscalSettings({ primary_color: newColor });
      setSettings(updated);
      onStatus({ key: 'settings:branding:color', level: 'success', message: `Color de marca cambiado a ${COLOR_THEMES[newColor].name}.` });
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
    onStatus({ key: 'settings:branding:logo', level: 'info', message: 'Subiendo logo institucional...', toast: false });
    try {
      const url = await apiClient.uploadLogo(logoFile);
      setLogoUrl(url);
      onStatus({ key: 'settings:branding:logo', level: 'success', message: 'Logo institucional actualizado.' });
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
    <section className="grid gap-4">
      <header><h2 className="text-lg font-semibold">Marca institucional</h2><p className="text-sm text-muted-foreground">Logo y color de marca visibles en encabezados, recibos y acciones.</p></header>
      {error ? <Alert variant="destructive"><TriangleAlert /><AlertTitle>No se pudo guardar</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Logo institucional</CardTitle><CardDescription>Aparece en recibos y en la cabecera de la aplicación.</CardDescription></CardHeader>
          <CardContent className="grid gap-4">
            <div className="rounded-xl border bg-muted/40 p-5">
              <InstitutionalIdentity hospitalName={displayHospitalName(settings?.hospital_name)} location={settings?.receipt_location?.trim() || 'Tocoa, Colón, Honduras'} logoUrl={logoUrl} />
              {!logoUrl ? <p className="mt-4 text-xs text-muted-foreground">Se usa un wordmark tipográfico provisional hasta recibir un SVG o PNG oficial autorizado.</p> : null}
            </div>
            {canEdit ? (
              <Field>
                <FieldLabel htmlFor="logo-input">Seleccionar imagen (.png, .jpg)</FieldLabel>
                <Input id="logo-input" type="file" accept="image/png, image/jpeg, image/jpg" disabled={uploading} onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)} />
                <FieldDescription>El archivo se guarda en el servidor local y no depende de servicios externos.</FieldDescription>
                {logoFile ? <Button type="button" onClick={handleUploadLogo} disabled={uploading} className="w-full">{uploading ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}{uploading ? 'Subiendo…' : 'Subir logo'}</Button> : null}
              </Field>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Color de marca</CardTitle><CardDescription>Se aplica a botones, acentos y estados activos.</CardDescription></CardHeader>
          <CardContent className="grid gap-3">
            {(Object.keys(COLOR_THEMES) as ColorTheme[]).map((themeKey) => {
              const theme = COLOR_THEMES[themeKey];
              const active = colorTheme === themeKey;
              return (
                <Button key={themeKey} type="button" variant={active ? 'default' : 'outline'} onClick={() => handleSaveColor(themeKey)} disabled={!canEdit} className="h-auto w-full justify-between p-3 text-left">
                  <span className="flex items-center gap-3"><span aria-hidden="true" className="brand-theme-swatch size-5 rounded-full border shadow-sm" data-theme-swatch={themeKey} /><span>{theme.name}</span></span>
                  {active ? <Check data-icon="inline-end" /> : null}
                </Button>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
