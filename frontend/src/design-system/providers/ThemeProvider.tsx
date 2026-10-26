import { useEffect, type ReactNode } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';

/* Tema claro hospitalario único. Una preferencia oscura anterior no cambia
 * la identidad del producto ni los controles nativos. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  return <TooltipProvider>{children}</TooltipProvider>;
}
