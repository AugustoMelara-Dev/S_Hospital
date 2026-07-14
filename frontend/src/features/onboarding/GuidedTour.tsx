import { ArrowLeftOutlined, ArrowRightOutlined, CheckCircleOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { Button, Modal } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      footer={null}
      width={640}
      title="Guía rápida del sistema"
      destroyOnHidden
    >
      <p className="mb-5 text-sm text-muted-foreground">
        Recorrido operativo para recordar las pantallas principales.
      </p>
      <div className="space-y-5">
        <div data-testid="guided-tour-step" className="border border-border bg-muted p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center bg-primary text-primary-foreground">
              <EnvironmentOutlined aria-hidden="true" className="text-lg" />
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
            <Button
              key={item.path}
              type={stepIndex === index ? 'primary' : 'default'}
              className="h-auto min-h-11 justify-start whitespace-normal px-3 py-3 text-left text-xs font-semibold"
              onClick={() => goToStep(stepIndex)}
            >
              {item.title}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          <Button disabled={index === 0} onClick={() => goToStep(index - 1)} icon={<ArrowLeftOutlined aria-hidden="true" />}>
            Anterior
          </Button>
          {index < steps.length - 1 ? (
            <Button type="primary" onClick={() => goToStep(index + 1)}>
              Siguiente
              <ArrowRightOutlined aria-hidden="true" />
            </Button>
          ) : (
            <Button type="primary" onClick={finish} icon={<CheckCircleOutlined aria-hidden="true" />}>
              Finalizar
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function shouldAutoOpenGuidedTour(): boolean {
  return localStorage.getItem(AUTO_KEY) === 'true' && localStorage.getItem(COMPLETED_KEY) !== 'true';
}
