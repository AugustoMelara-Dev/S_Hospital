import { PageHeader, Tabs } from '@/ui';
import { GroupsTab } from './GroupsTab';
import { ServicesTab } from './ServicesTab';

export default function CatalogoPage() {
  return (
    <>
      <PageHeader eyebrow="Administración" title="Catálogo y precios" description="Productos, servicios, categorías y áreas." />
      <Tabs
        label="Secciones del catálogo"
        items={[
          { value: 'conceptos', label: 'Conceptos', content: <ServicesTab /> },
          { value: 'categorias', label: 'Categorías', content: <GroupsTab kind="categories" /> },
          { value: 'areas', label: 'Áreas', content: <GroupsTab kind="areas" /> },
        ]}
      />
    </>
  );
}
