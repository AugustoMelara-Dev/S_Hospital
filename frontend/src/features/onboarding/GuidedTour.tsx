import { ArrowLeftIcon, ArrowRightIcon, CircleCheckIcon, MapPinIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const AUTO_KEY = 'hospital-onboarding-auto';
const COMPLETED_KEY = 'hospital-onboarding-completed';

type GuidedTourProps = { open: boolean; onOpenChange: (open: boolean) => void };

const steps = [
  { title: 'Inicio', path: '/dashboard', body: 'Revise caja activa, métricas del día y accesos para comenzar el turno.' },
  { title: 'Caja', path: '/cashbox', body: 'Abra caja antes de cobrar, registre el contado inicial y cierre con arqueo cuando termine el turno.' },
  { title: 'Nueva factura', path: '/billing/new', body: 'Busque servicios por nombre, categoría o código, confirme el paciente y cobre desde el carrito.' },
  { title: 'Historial', path: '/invoices', body: 'Consulte facturas, reimprima recibos y solicite anulaciones con motivo cuando aplique.' },
  { title: 'Reportes', path: '/reports', body: 'Filtre ingresos, servicios, auditoría y cajas según los permisos asignados a su rol.' },
  { title: 'Respaldos', path: '/backups', body: 'Revise respaldos locales y pruebas de recuperación antes de operar en producción.' },
];

export function GuidedTour({ open, onOpenChange }: GuidedTourProps) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(open);
  const step = steps[index];
  const progress = useMemo(() => `${index + 1} de ${steps.length}`, [index]);

  useEffect(() => { if (open) setIndex(0); }, [open]);

  useEffect(() => {
    if (!wasOpenRef.current && open) {
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    if (wasOpenRef.current && !open) {
      window.setTimeout(() => previousFocusRef.current?.focus(), 0);
    }
    wasOpenRef.current = open;
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Guía rápida del sistema</DialogTitle>
          <DialogDescription>Recorrido operativo para recordar las pantallas principales.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          <div data-testid="guided-tour-step" className="rounded-xl bg-muted p-5">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><MapPinIcon aria-hidden="true" /></div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-muted-foreground">{progress}</p>
                <h3 className="mt-1 text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.body}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {steps.map((item, stepIndex) => (
              <Button key={item.path} variant={stepIndex === index ? 'default' : 'outline'} className="h-auto min-h-11 justify-start whitespace-normal px-3 py-3 text-left text-xs font-semibold" onClick={() => goToStep(stepIndex)}>
                {item.title}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            <Button variant="outline" disabled={index === 0} onClick={() => goToStep(index - 1)}><ArrowLeftIcon aria-hidden="true" /> Anterior</Button>
            {index < steps.length - 1 ? (
              <Button onClick={() => goToStep(index + 1)}>Siguiente <ArrowRightIcon aria-hidden="true" /></Button>
            ) : (
              <Button onClick={finish}><CircleCheckIcon aria-hidden="true" /> Finalizar</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function shouldAutoOpenGuidedTour(): boolean {
  return localStorage.getItem(AUTO_KEY) === 'true' && localStorage.getItem(COMPLETED_KEY) !== 'true';
}
