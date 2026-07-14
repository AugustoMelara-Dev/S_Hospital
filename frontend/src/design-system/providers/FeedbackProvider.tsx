import { App as AntApp } from 'antd';
import { createContext, type ReactNode, useContext, useMemo } from 'react';

export type FeedbackApi = {
  error: (content: string) => void;
  info: (content: string) => void;
  success: (content: string) => void;
  warning: (content: string) => void;
};

const FeedbackContext = createContext<FeedbackApi | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { message: feedback } = AntApp.useApp();
  const value = useMemo<FeedbackApi>(() => ({
    error: (content) => { void feedback.error(content); },
    info: (content) => { void feedback.info(content); },
    success: (content) => { void feedback.success(content); },
    warning: (content) => { void feedback.warning(content); },
  }), [feedback]);
  return <FeedbackContext.Provider value={value}>{children}</FeedbackContext.Provider>;
}

export function useFeedback(): FeedbackApi {
  const feedback = useContext(FeedbackContext);
  if (!feedback) throw new Error('useFeedback must be used inside FeedbackProvider');
  return feedback;
}
