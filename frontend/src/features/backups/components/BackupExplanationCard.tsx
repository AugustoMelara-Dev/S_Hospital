import { Archive, Info } from 'lucide-react';
import { Button } from '../../../components/ui/button';
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
            <h2 className="mb-1 font-semibold">Respaldos del hospital</h2>
            <p className="text-sm text-muted-foreground">
              Los respaldos protegen la información de facturación, caja y reportes.
              Cree uno antes de cambios importantes y confirme que quede protegido.
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
        <Archive className="mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="mb-2 text-lg font-semibold">No hay respaldos</h3>
        <p className="mb-4 text-center text-muted-foreground">
          Todavía no se ha creado ningún respaldo. Cree el primero para proteger los datos del hospital.
        </p>
        {canCreate && onCreate && (
          <Button type="button" variant="default" size="sm" onClick={onCreate}>
            <Archive className="h-4 w-4" />
            Crear respaldo
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
