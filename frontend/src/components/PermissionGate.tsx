import { type ReactNode } from 'react';
import { EmptyState } from './ui/states';

type PermissionGateProps = {
  allowed: boolean;
  children: ReactNode;
  fallback?: ReactNode;
  reason?: string;
};

export function PermissionGate({ allowed, children, fallback, reason }: PermissionGateProps) {
  if (allowed) {
    return <>{children}</>;
  }

  return (
    <>
      {fallback ?? (
        <EmptyState
          title="Sin permisos"
          description={reason ?? 'Su usuario no tiene permisos para abrir este modulo.'}
        />
      )}
    </>
  );
}
