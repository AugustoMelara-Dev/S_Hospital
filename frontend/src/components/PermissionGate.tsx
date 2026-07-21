import { type ReactNode } from 'react';
import { RouteState } from '@/design-system/patterns/RouteState';

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

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <RouteState
      kind="denied"
      headingLevel={1}
      title="Sin permisos"
      description={`${reason ?? 'Su usuario no tiene permisos para abrir este módulo.'} Si cree que debe usar esta pantalla, pida a un supervisor que revise su rol.`}
      action={{ href: '/help', label: 'Ver guía de ayuda' }}
    />
  );
}
