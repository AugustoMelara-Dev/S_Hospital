import type { ReactNode } from 'react';
import { ThemeProvider } from './ThemeProvider';

interface DesignSystemProviderProps {
  children: ReactNode;
  compact?: boolean;
}

export function DesignSystemProvider({ children }: DesignSystemProviderProps) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
