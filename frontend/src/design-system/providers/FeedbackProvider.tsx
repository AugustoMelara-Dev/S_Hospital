import { App as AntApp } from 'antd';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import type { OperationalStatusEvent } from '@/app/operationalStatus';

export type FeedbackApi = {
  error: (content: string) => void;
  info: (content: string) => void;
  success: (content: string) => void;
  warning: (content: string) => void;
  notify: (event: OperationalStatusEvent) => void;
};

const FeedbackContext = createContext<FeedbackApi | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { message: feedback } = AntApp.useApp();
  const value = useMemo<FeedbackApi>(() => ({
    error: (content) => { void feedback.error(content); },
    info: (content) => { void feedback.info(content); },
    success: (content) => { void feedback.success(content); },
    warning: (content) => { void feedback.warning(content); },
    notify: (event) => {
      void feedback.open({
        content: event.message,
        key: event.key ?? `${event.level}:${event.message}`,
        type: event.level,
      });
    },
  }), [feedback]);
  return <FeedbackContext.Provider value={value}>{children}</FeedbackContext.Provider>;
}

export function useFeedback(): FeedbackApi {
  const feedback = useContext(FeedbackContext);
  if (!feedback) throw new Error('useFeedback must be used inside FeedbackProvider');
  return feedback;
}
