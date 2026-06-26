import { Archive, Info } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';

export function BackupExplanationCard() {
  return (
    <Card className="border-operational-border bg-operational-surface shadow-operational">
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-operational-panel">
            <Info aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="mb-1 font-semibold">Respaldos del hospital</h3>
            <p className="text-sm text-muted-foreground">
              Los respaldos protegen la informacion de facturacion, caja y reportes.
              Cree uno antes de cambios importantes y confirme que quede protegido.
            </p>
            <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
              <div className="rounded-panel border border-operational-border bg-operational-panel p-3">
                <p className="font-medium">1. Crear</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Use el boton manual cuando cierre caja, antes de mantenimiento o antes de actualizar.
                </p>
              </div>
              <div className="rounded-panel border border-operational-border bg-operational-panel p-3">
                <p className="font-medium">2. Verificar</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Debe quedar completado, con tamano y huella SHA256 visible.
                </p>
              </div>
              <div className="rounded-panel border border-operational-border bg-operational-panel p-3">
                <p className="font-medium">3. Restaurar con prueba</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  No hay restauracion directa aqui. Primero se valida en una base descartable para no pisar datos reales.
                </p>
              </div>
            </div>
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
