import { type ReactNode } from 'react';
import { Button } from './ui/button';
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
          description={`${reason ?? 'Su usuario no tiene permisos para abrir este modulo.'} Si cree que debe usar esta pantalla, pida a un supervisor que revise su rol.`}
          action={
            <Button asChild variant="outline">
              <a href="/support">Ver pasos de soporte</a>
            </Button>
          }
        />
      )}
    </>
  );
}
