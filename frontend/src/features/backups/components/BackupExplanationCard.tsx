import { Archive } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';

export function BackupEmptyState({
  onCreate,
  canCreate,
}: {
  onCreate?: () => void;
  canCreate: boolean;
}) {
  return (
    <Card className="border-operational-border bg-operational-surface shadow-operational">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Archive aria-hidden="true" className="mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="mb-2 text-lg font-semibold">No hay respaldos</h3>
        <p className="mb-4 text-center text-muted-foreground">
          {canCreate
            ? 'Todavia no se ha creado ningun respaldo. Cree el primero para proteger los datos del hospital.'
            : 'Todavia no se ha creado ningun respaldo. Pida a un administrador autorizado crear el primero.'}
        </p>
        {canCreate && onCreate && (
          <Button type="button" variant="default" size="sm" onClick={onCreate}>
            <Archive aria-hidden="true" className="h-4 w-4" />
            Crear respaldo
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
