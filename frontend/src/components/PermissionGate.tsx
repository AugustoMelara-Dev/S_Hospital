import { type ReactNode } from 'react';
import { Button, Result } from 'antd';

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
    <Result
      status="403"
      title={<h2 className="text-2xl font-semibold">Sin permisos</h2>}
      subTitle={`${reason ?? 'Su usuario no tiene permisos para abrir este modulo.'} Si cree que debe usar esta pantalla, pida a un supervisor que revise su rol.`}
      extra={<Button href="/help">Ver guia de ayuda</Button>}
    />
  );
}
