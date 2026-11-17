import { Construction } from 'lucide-react';
import { Card } from './Card';
import { EmptyState } from './EmptyState';

/** Placeholder body for feature stubs. */
export function UnderConstruction() {
  return (
    <Card>
      <EmptyState icon={<Construction />} title="En construcción" description="Esta sección estará disponible pronto." />
    </Card>
  );
}
