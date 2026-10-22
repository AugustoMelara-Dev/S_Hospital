import { Database } from 'lucide-react';
import { AdminEmpty } from '@/design-system/admin/components';
import { PRIMARY_BUTTON } from '../backupsUi';

export function BackupEmptyState({ onCreate, canCreate }: { onCreate?: () => void; canCreate: boolean }) {
  return (
    <AdminEmpty
      title="No hay respaldos"
      description={canCreate ? 'Todavía no se ha creado ningún respaldo. Cree el primero para proteger los datos del hospital.' : 'Todavía no se ha creado ningún respaldo. Pida a un administrador autorizado crear el primero.'}
      action={canCreate && onCreate ? (
        <button type="button" data-ui-press className={PRIMARY_BUTTON} onClick={onCreate}>
          <Database aria-hidden="true" className="size-4" strokeWidth={1.5} />Crear respaldo
        </button>
      ) : undefined}
    />
  );
}
