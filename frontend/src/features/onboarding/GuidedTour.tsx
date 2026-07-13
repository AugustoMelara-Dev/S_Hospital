import { ArrowLeft, ArrowRight, CheckCircle2, MapPinned } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';

const AUTO_KEY = 'hospital-onboarding-auto';
const COMPLETED_KEY = 'hospital-onboarding-completed';

type GuidedTourProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const steps = [
  {
    title: 'Inicio',
    path: '/dashboard',
    body: 'Revise caja activa, métricas del día y accesos para comenzar el turno.',
  },
  {
    title: 'Caja',
    path: '/cashbox',
    body: 'Abra caja antes de cobrar, registre el contado inicial y cierre con arqueo cuando termine el turno.',
  },
  {
    title: 'Nueva factura',
    path: '/billing/new',
    body: 'Busque servicios por nombre, categoría o código, confirme el paciente y cobre desde el carrito.',
  },
  {
    title: 'Historial',
    path: '/invoices',
    body: 'Consulte facturas, reimprima recibos y solicite anulaciones con motivo cuando aplique.',
  },
  {
    title: 'Reportes',
    path: '/reports',
    body: 'Filtre ingresos, servicios, auditoría y cajas según los permisos asignados a su rol.',
  },
  {
    title: 'Respaldos',
    path: '/backups',
    body: 'Revise respaldos locales y pruebas de recuperación antes de operar en producción.',
  },
];

export function GuidedTour({ open, onOpenChange }: GuidedTourProps) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const progress = useMemo(() => `${index + 1} de ${steps.length}`, [index]);

  useEffect(() => {
    if (open) {
      setIndex(0);
    }
  }, [open]);

  function goToStep(nextIndex: number) {
    const bounded = Math.min(Math.max(nextIndex, 0), steps.length - 1);
    setIndex(bounded);
    navigate(steps[bounded].path);
  }

  function finish() {
    localStorage.setItem(COMPLETED_KEY, 'true');
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title="Guía rápida del sistema"
      description="Recorrido operativo para recordar las pantallas principales."
    >
      <div className="space-y-5">
        <div className="rounded-lg border border-secondary/20 bg-accent p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
              <MapPinned aria-hidden="true" className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-muted-foreground">{progress}</p>
              <h3 className="mt-1 text-lg font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.body}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {steps.map((item, stepIndex) => (
            <button
              key={item.path}
              type="button"
              className={`rounded-md border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                stepIndex === index
                  ? 'border-secondary bg-secondary/10 text-secondary'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted'
              }`}
              onClick={() => goToStep(stepIndex)}
            >
              {item.title}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          <Button type="button" variant="secondary" disabled={index === 0} onClick={() => goToStep(index - 1)}>
            <ArrowLeft aria-hidden="true" className="size-4" />
            Anterior
          </Button>
          {index < steps.length - 1 ? (
            <Button type="button" onClick={() => goToStep(index + 1)}>
              Siguiente
              <ArrowRight aria-hidden="true" className="size-4" />
            </Button>
          ) : (
            <Button type="button" onClick={finish}>
              <CheckCircle2 aria-hidden="true" className="size-4" />
              Finalizar
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}

export function shouldAutoOpenGuidedTour(): boolean {
  return localStorage.getItem(AUTO_KEY) === 'true' && localStorage.getItem(COMPLETED_KEY) !== 'true';
}
