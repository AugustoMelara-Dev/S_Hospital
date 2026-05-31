export type ClientIssueDescriptor = {
  severity: 'info' | 'warning' | 'error';
  technicalCode: string;
  message: string;
};

export function describeClientIssue(error: unknown): ClientIssueDescriptor {
  const status = error instanceof Error && 'status' in error && typeof error.status === 'number' ? error.status : null;
  const message = error instanceof Error ? error.message : '';

  if (status === 401 || status === 419) {
    return {
      severity: 'warning',
      technicalCode: 'SESSION_EXPIRED',
      message: 'Sesion vencida. Vuelva a iniciar sesion para continuar.',
    };
  }

  if (status !== null) {
    if (status === 0) {
      return {
        severity: 'error',
        technicalCode: 'NETWORK_UNAVAILABLE',
        message: 'No se pudo conectar con el servidor LAN.',
      };
    }

    if (status === 403) {
      return {
        severity: 'warning',
        technicalCode: 'HTTP_403',
        message: 'No tiene permiso para esta accion.',
      };
    }

    if (status === 419) {
      return {
        severity: 'warning',
        technicalCode: 'HTTP_419',
        message: 'La sesion expiro. Actualice la pantalla e intente de nuevo.',
      };
    }

    if (status >= 500) {
      return {
        severity: 'error',
        technicalCode: `HTTP_${status}`,
        message: 'El servidor LAN no pudo completar la operacion.',
      };
    }

    return {
      severity: 'warning',
      technicalCode: `HTTP_${status}`,
      message,
    };
  }

  return {
    severity: 'error',
    technicalCode: 'CLIENT_ERROR',
    message: 'Ocurrio un problema en la pantalla actual.',
  };
}

export function sanitizeClientMessage(value: string): string {
  return value
    .replace(/password|contrase.{0,2}a|token|secret|APP_KEY|DB_PASSWORD/gi, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}
