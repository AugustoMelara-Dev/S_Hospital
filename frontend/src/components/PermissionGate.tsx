import { type ReactNode } from 'react';
import { Button } from './ui/button';

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
    <section
      aria-labelledby="permission-denied-title"
      className="rounded-md border border-border bg-card p-5 text-card-foreground shadow-sm"
    >
      <div className="flex flex-col gap-2">
        <h1 id="permission-denied-title" className="text-2xl font-semibold leading-tight text-foreground">
          Sin permisos
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {reason ?? 'Su usuario no tiene permisos para abrir este modulo.'} Si cree que debe usar esta pantalla, pida a un supervisor que revise su rol.
        </p>
      </div>
      <div className="mt-5">
        <Button asChild variant="outline">
          <a href="/help">Ver guia de ayuda</a>
        </Button>
      </div>
    </section>
  );
}
