import { Link } from 'react-router';
import { buttonSizes, buttonVariants } from '@/ui/Button';
import { cn } from '@/lib/cn';

export default function NotFoundPage() {
  return (
    <section
      aria-labelledby="nf-title"
      className="mx-auto mt-[8vh] flex max-w-[520px] flex-col rounded-[var(--radius-md)] border border-junta bg-surface"
    >
      <div className="flex flex-col gap-1.5 border-b border-junta px-6 py-5">
        <h1 id="nf-title" className="text-[22px] leading-7 font-bold tracking-[-0.015em] text-ink">
          Página no encontrada
        </h1>
        <p className="text-[14px] leading-5 text-ink-2">La dirección no existe o fue movida. Revise el enlace o vuelva al resumen.</p>
      </div>
      <div className="flex justify-end gap-2 bg-surface-2 px-6 py-3">
        <Link
          to="/"
          className={cn(
            'pressable inline-flex items-center justify-center rounded-[var(--radius-md)] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]',
            buttonVariants.secondary,
            buttonSizes.md,
          )}
        >
          Ir al resumen
        </Link>
      </div>
    </section>
  );
}
