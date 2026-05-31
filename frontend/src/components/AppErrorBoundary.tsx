import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Alert } from './ui/alert';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { logClientIssue } from '../lib/support/clientIssueLogger';

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
      <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                <AlertTriangle aria-hidden="true" />
              </div>
              <div>
                <CardTitle>La pantalla no pudo cargarse</CardTitle>
                <p className="text-sm text-muted-foreground">
                  El sistema siguio activo, pero esta vista tuvo un error de interfaz.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Alert variant="destructive" title="Error controlado">
              Recargue la pantalla. Si vuelve a ocurrir, avise a supervisor o soporte e indique que pantalla estaba usando. El detalle tecnico quedo registrado para soporte.
            </Alert>
            <Button type="button" onClick={() => window.location.reload()}>
              <RefreshCw data-icon="inline-start" aria-hidden="true" />
              Recargar pantalla
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }
}
