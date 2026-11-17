import { PageHeader, Tabs } from '@/ui';
import { GroupsTab } from './GroupsTab';
import { ServicesTab } from './ServicesTab';

export default function CatalogoPage() {
  return (
    <>
      <PageHeader title="Catálogo y precios" description="Productos, servicios, categorías y áreas." className="pb-3" />
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
