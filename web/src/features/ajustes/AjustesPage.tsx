import { usePermissions } from '@/auth/hooks';
import { PageHeader, Tabs, type TabItem } from '@/ui';
import { FiscalTab } from './FiscalTab';
import { IdentidadTab } from './IdentidadTab';
import { ImpresionTab } from './ImpresionTab';
import { ImpuestosTab } from './ImpuestosTab';
import { ReglasTab } from './ReglasTab';

export default function AjustesPage() {
  const { can } = usePermissions();
  const items: TabItem[] = [];
  if (can('settings.view')) {
    items.push(
      { value: 'identidad', label: 'Identidad', content: <IdentidadTab /> },
      { value: 'fiscal', label: 'Numeración fiscal', content: <FiscalTab /> },
      { value: 'impuestos', label: 'Impuestos', content: <ImpuestosTab /> },
      { value: 'reglas', label: 'Reglas de cobro', content: <ReglasTab /> },
    );
  }
  if (can('receipt_settings.view')) items.push({ value: 'impresion', label: 'Impresión', content: <ImpresionTab /> });

  return (
    <>
      <PageHeader
        title="Ajustes institucionales"
        description="Identidad, numeración fiscal, impuestos, reglas de cobro e impresión."
        className="pb-3"
      />
      <Tabs label="Secciones de ajustes" items={items} />
    </>
  );
}
