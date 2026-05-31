import { describeClientIssue, sanitizeClientMessage } from './errorCatalog';

function cookieValue(name: string): string | null {
  const prefix = `${name}=`;
  const cookie = document.cookie
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

export function logClientIssue(
  error: unknown,
  context: { action?: string; module?: string; requestId?: string; route?: string } = {},
): void {
  if (context.route?.includes('/api/system/client-errors')) {
    return;
  }

  const issue = describeClientIssue(error);
  const route = context.route ?? window.location.pathname;
  const xsrfToken = cookieValue('XSRF-TOKEN');

  fetch('/api/system/client-errors', {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}),
    },
    body: JSON.stringify({
      event_type: 'api_error',
      severity: issue.severity,
      safe_message: sanitizeClientMessage(issue.message),
      technical_code: issue.technicalCode,
      route,
      status_code: issue.technicalCode.startsWith('HTTP_') ? Number(issue.technicalCode.replace('HTTP_', '')) : undefined,
      context: {
        action: context.action,
        module: context.module,
        request_id: context.requestId,
        screen: route,
      },
      occurred_at: new Date().toISOString(),
    }),
  }).catch(() => undefined);
}
