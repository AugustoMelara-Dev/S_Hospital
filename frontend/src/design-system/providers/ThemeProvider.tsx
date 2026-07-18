import { createContext, type ReactNode, useContext } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useTheme } from '@/hooks/useTheme';

type ThemeContextValue = ReturnType<typeof useTheme>;

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();

  return (
    <ThemeContext.Provider value={theme}>
      <TooltipProvider>{children}</TooltipProvider>
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useThemeContext must be used inside ThemeProvider');
  return theme;
}
