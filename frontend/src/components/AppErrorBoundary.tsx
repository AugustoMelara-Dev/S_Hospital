import { Component, type ErrorInfo, type ReactNode } from 'react';
import { CircleHelpIcon } from 'lucide-react';
import { RouteState } from '../design-system/patterns/RouteState';
import { logClientIssue } from '../lib/support/clientIssueLog';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  error: Error | null;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logClientIssue(error, {
      action: 'render',
      module: 'ui',
      route: window.location.pathname,
    });

    if (import.meta.env.DEV) {
      console.error('App render failure', error, errorInfo.componentStack);
    }
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground sm:p-6">
        <div className="w-full max-w-3xl overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <RouteState
            kind="error"
            title="La pantalla no pudo cargarse"
            description="El sistema sigue activo, pero esta vista tuvo un error de interfaz. Recargue la pantalla para continuar."
            detail="Si vuelve a ocurrir, prepare el resumen seguro desde Ayuda y avise a supervisor o soporte. El detalle técnico quedó guardado en este navegador."
            action={{ label: 'Recargar pantalla', onClick: () => window.location.reload() }}
          />
          <div className="border-t border-operational-border px-5 py-3 sm:px-8">
            <a
              href="/help"
              className="inline-flex min-h-11 items-center gap-2 py-2 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CircleHelpIcon aria-hidden="true" />
              Abrir ayuda
            </a>
          </div>
        </div>
      </main>
    );
  }
}
