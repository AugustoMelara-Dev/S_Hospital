import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { AdminEmpty, AdminPageHeader, AdminTabs, type AdminTabItem } from '@/design-system/admin/components';
import { useAdminSession } from '@/shell/admin/AdminSessionContext';
import { HospitalSettingsView } from '@/features/settings/HospitalSettingsView';
import { FiscalNumerationView } from '@/features/settings/FiscalNumerationView';
import { OperationalRulesView } from '@/features/settings/OperationalRulesView';
import { TaxRatesView } from '@/features/settings/TaxRatesView';
import { InstitutionalReceiptSettingsView } from '@/features/receipt-settings/InstitutionalReceiptSettingsView';

/** Una sola navegación por tarea: identidad, numeración, impuestos, reglas e impresión. */
export function AjustesView() {
  const { has, onStatus } = useAdminSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const canViewFiscal = has('settings.fiscal.view');
  const canEditFiscal = has('settings.fiscal.update');
  const canEditOperational = has('settings.operational.update');
  const canViewReceipt = has('receipt_settings.view');
  const canEditReceipt = has('receipt_settings.update');
  const canEditAdvanced = has('receipt_settings.advanced');

  const items: AdminTabItem[] = [
    ...(canViewFiscal ? [
      { id: 'identidad', label: 'Identidad' },
      { id: 'numeracion', label: 'Numeración' },
      { id: 'impuestos', label: 'Impuestos' },
    ] : []),
    ...(canEditOperational ? [{ id: 'reglas', label: 'Reglas de cobro' }] : []),
    ...(canViewReceipt && canEditAdvanced ? [{ id: 'impresion', label: 'Impresión' }] : []),
  ];

  const requested = searchParams.get('panel') === 'papel' ? 'impresion' : searchParams.get('panel');
  const first = items[0]?.id ?? '';
  const selected = items.some((item) => item.id === requested) ? requested ?? first : first;
  const [active, setActive] = useState(selected);
  const [mountedPanels, setMountedPanels] = useState<readonly string[]>(() => [selected]);

  useEffect(() => {
    setActive((current) => current === selected ? current : selected);
    setMountedPanels((current) => current.includes(selected) ? current : [...current, selected]);
  }, [selected]);

  const changePanel = (nextPanel: string) => {
    setMountedPanels((current) => current.includes(nextPanel) ? current : [...current, nextPanel]);
    setActive(nextPanel);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('panel', nextPanel);
      return next;
    }, { replace: true });
  };

  if (items.length === 0) {
    return <AdminEmpty title="Sin acceso a ajustes" description="Su rol no permite consultar esta configuración." />;
  }

  return (
    <section aria-labelledby="ajustes-title" className="flex flex-col gap-4">
      <AdminPageHeader
        headingId="ajustes-title"
        title="Ajustes institucionales"
        description="Datos del hospital, numeración, impuestos, reglas de cobro e impresión de los próximos documentos."
      />
      <AdminTabs ariaLabel="Secciones de ajustes" items={items} value={active} onValueChange={changePanel}>
        {canViewFiscal ? (
          <TabsPrimitive.Content value="identidad" forceMount={mountedPanels.includes('identidad') || undefined} className="pt-1 data-[state=inactive]:hidden">
            <HospitalSettingsView canEdit={canEditFiscal} onStatus={onStatus} />
          </TabsPrimitive.Content>
        ) : null}
        {canViewFiscal ? (
          <TabsPrimitive.Content value="numeracion" forceMount={mountedPanels.includes('numeracion') || undefined} className="pt-1 data-[state=inactive]:hidden">
            <FiscalNumerationView canEdit={canEditFiscal} onStatus={onStatus} />
          </TabsPrimitive.Content>
        ) : null}
        {canViewFiscal ? (
          <TabsPrimitive.Content value="impuestos" forceMount={mountedPanels.includes('impuestos') || undefined} className="pt-1 data-[state=inactive]:hidden">
            <TaxRatesView canEdit={canEditFiscal} onStatus={onStatus} />
          </TabsPrimitive.Content>
        ) : null}
        {canEditOperational ? (
          <TabsPrimitive.Content value="reglas" forceMount={mountedPanels.includes('reglas') || undefined} className="pt-1 data-[state=inactive]:hidden">
            <OperationalRulesView canEdit={canEditOperational} onStatus={onStatus} />
          </TabsPrimitive.Content>
        ) : null}
        {canViewReceipt && canEditAdvanced ? (
          <TabsPrimitive.Content value="impresion" forceMount={mountedPanels.includes('impresion') || undefined} className="pt-1 data-[state=inactive]:hidden">
            <InstitutionalReceiptSettingsView canEdit={canEditReceipt} canEditAdvanced={canEditAdvanced} onStatus={onStatus} />
          </TabsPrimitive.Content>
        ) : null}
      </AdminTabs>
    </section>
  );
}
