import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { toast } from 'sonner';
import type { OperationalStatusEvent } from '@/app/operationalStatus';
import { Toaster } from '@/components/ui/sonner';
import { useThemeContext } from './ThemeProvider';

export type FeedbackApi = {
  error: (content: string) => void;
  info: (content: string) => void;
  success: (content: string) => void;
  warning: (content: string) => void;
  notify: (event: OperationalStatusEvent) => void;
};

const FeedbackContext = createContext<FeedbackApi | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { isDark } = useThemeContext();
  const value = useMemo<FeedbackApi>(() => ({
    error: (content) => { toast.error(content); },
    info: (content) => { toast.info(content); },
    success: (content) => { toast.success(content); },
    warning: (content) => { toast.warning(content); },
    notify: (event) => {
      toast[event.level](event.message, { id: event.key ?? `${event.level}:${event.message}` });
    },
  }), []);
  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <Toaster theme={isDark ? 'dark' : 'light'} richColors closeButton position="top-right" />
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackApi {
  const feedback = useContext(FeedbackContext);
  if (!feedback) throw new Error('useFeedback must be used inside FeedbackProvider');
  return feedback;
}
