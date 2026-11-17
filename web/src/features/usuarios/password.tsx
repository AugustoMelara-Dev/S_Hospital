import { Check, Circle } from 'lucide-react';
import { cn } from '@/lib/cn';

/** SPEC §5.11: ≥12 caracteres con minúscula, mayúscula, número y símbolo. */
export const PASSWORD_RULES: Array<{ id: string; label: string; test: (p: string) => boolean }> = [
  { id: 'length', label: 'Al menos 12 caracteres', test: (p) => p.length >= 12 },
  { id: 'lower', label: 'Una letra minúscula', test: (p) => /[a-zà-ÿ]/.test(p) },
  { id: 'upper', label: 'Una letra mayúscula', test: (p) => /[A-ZÀ-Ý]/.test(p) },
  { id: 'digit', label: 'Un número', test: (p) => /\d/.test(p) },
  { id: 'symbol', label: 'Un símbolo', test: (p) => /[^A-Za-z0-9À-ÿ\s]/.test(p) },
];

export const passwordOk = (p: string) => PASSWORD_RULES.every((r) => r.test(p));

export function PasswordChecklist({ password }: { password: string }) {
  return (
    <ul aria-label="Requisitos de la contraseña" className="grid grid-cols-1 gap-1 sm:grid-cols-2">
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(password);
        return (
          <li
            key={r.id}
            data-ok={ok}
            className={cn('flex items-center gap-1.5 text-[12.5px] transition-colors duration-[120ms]', ok ? 'text-ok' : 'text-ink-3')}
          >
            {ok ? <Check className="size-3.5" aria-hidden="true" strokeWidth={2.5} /> : <Circle className="size-3" aria-hidden="true" />}
            <span>{r.label}</span>
            <span className="sr-only">{ok ? '(cumplido)' : '(pendiente)'}</span>
          </li>
        );
      })}
    </ul>
  );
}
