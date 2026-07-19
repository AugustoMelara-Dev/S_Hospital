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

const feedbackDuration: Record<OperationalStatusEvent['level'], number> = {
  error: Number.POSITIVE_INFINITY,
  info: 8_000,
  success: 6_000,
  warning: 12_000,
};

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { isDark } = useThemeContext();
  const value = useMemo<FeedbackApi>(() => ({
    error: (content) => { toast.error(content, { duration: feedbackDuration.error }); },
    info: (content) => { toast.info(content, { duration: feedbackDuration.info }); },
    success: (content) => { toast.success(content, { duration: feedbackDuration.success }); },
    warning: (content) => { toast.warning(content, { duration: feedbackDuration.warning }); },
    notify: (event) => {
      toast[event.level](event.message, {
        duration: feedbackDuration[event.level],
        id: event.key ?? `${event.level}:${event.message}`,
      });
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
