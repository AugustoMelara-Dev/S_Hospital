import { LifeBuoy, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type RecoveryReadinessCardProps = {
  readinessBlockers: string[];
};

export function RecoveryReadinessCard({ readinessBlockers }: RecoveryReadinessCardProps) {
  const titleId = 'local-recovery-title';

  return (
    <section aria-labelledby={titleId}>
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <RotateCcw aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <CardTitle>
                <h2 id={titleId}>Restauración local</h2>
              </CardTitle>
              <CardDescription>
                Recuperación protegida para la computadora donde está instalado S_Hospital.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="space-y-2 text-sm leading-relaxed">
            <p>Use el acceso “Mantenimiento S_Hospital” en esta computadora.</p>
            <p className="text-muted-foreground">
              La restauración detiene temporalmente el sistema y crea un respaldo preventivo.
            </p>
          </div>

          {readinessBlockers.length > 0 ? (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-warning-foreground">
              <p className="mb-2 text-sm font-medium">Pendientes antes de recuperar</p>
              <ul aria-label="Pendientes para recuperación" className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {readinessBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin pendientes de preparación detectados.</p>
          )}

          <div>
            <Button asChild variant="outline">
              <a href="/support">
                <LifeBuoy aria-hidden="true" data-icon="inline-start" />
                Abrir centro de soporte
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
