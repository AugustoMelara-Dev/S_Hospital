import { useEffect, type ReactNode } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';

/*
 * Identidad dark única (IDENTIDAD_DARK_20261016, suposición 2 del doc): no hay
 * toggle ni paleta de color seleccionable ni modo 'system'. El proveedor solo
 * garantiza el estado global del tema —clase `html.dark` siempre presente— y
 * monta el TooltipProvider compartido.
 *
 * La clase alimenta los bloques canónicos de styles.css (elevación dark §3) y
 * los gadgets de color global. Sustituye a useTheme/colorThemes (R2, retirados
 * del mandato sustituido); localStorage queda sin lector como compatibilidad.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return <TooltipProvider>{children}</TooltipProvider>;
}
