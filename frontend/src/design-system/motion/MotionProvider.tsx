import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';
import { type ReactNode } from 'react';

export const clinicalMotion = {
  control: { duration: 0.15 },
  panel: { duration: 0.22 },
};

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
