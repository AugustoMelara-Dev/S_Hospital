import { Archive, Info } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/card';

export function BackupExplanationCard() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Info className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold mb-1">Sistema de Backups</h3>
            <p className="text-sm text-muted-foreground">
              Los backups son copias de seguridad de la base de datos del sistema.
              Se recomienda crear un backup antes de cambios importantes.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function BackupEmptyState({
  onCreate,
  canCreate,
}: {
  onCreate?: () => void;
  canCreate: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Archive className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No hay backups</h3>
        <p className="text-muted-foreground text-center mb-4">
          No se han creado backups todavía.
          Cree su primer backup para proteger sus datos.
        </p>
        {canCreate && onCreate && (
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Archive className="h-4 w-4" />
            Crear Backup
          </button>
        )}
      </CardContent>
    </Card>
  );
}