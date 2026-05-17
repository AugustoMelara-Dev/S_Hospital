import { type ReactNode } from 'react';
import { EmptyState } from './ui/states';

type PermissionGateProps = {
  allowed: boolean;
  children: ReactNode;
  fallback?: ReactNode;
};

export function PermissionGate({ allowed, children, fallback }: PermissionGateProps) {
  if (allowed) {
    return <>{children}</>;
  }

  return (
    <>
      {fallback ?? (
        <EmptyState
          title="Sin permisos"
          description="Su usuario no tiene permisos para abrir este modulo."
        />
      )}
    </>
  );
}
