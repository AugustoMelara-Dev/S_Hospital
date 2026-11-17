import { Link } from 'react-router';
import { MapPinOff } from 'lucide-react';
import { EmptyState } from '@/ui/EmptyState';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <EmptyState
        icon={<MapPinOff />}
        title="Página no encontrada"
        description="La dirección no existe o fue movida. Revise el enlace o vuelva al inicio."
        action={
          <Link
            to="/"
            className="pressable inline-flex h-9 items-center rounded-[var(--radius-sm)] bg-brand px-3.5 text-sm font-medium text-brand-ink hover:bg-brand-hover"
          >
            Ir al resumen
          </Link>
        }
      />
    </div>
  );
}
