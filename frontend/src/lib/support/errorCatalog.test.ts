import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/base';
import { PERMISSION_DENIED_MESSAGE, describeClientIssue, sanitizeClientMessage } from './errorCatalog';

describe('errorCatalog', () => {
  it('maps common operational errors to human messages', () => {
    expect(describeClientIssue(new ApiError('Unauthenticated', 401))).toMatchObject({
      severity: 'warning',
      technicalCode: 'SESSION_EXPIRED',
      message: expect.stringMatching(/sesion vencida/i),
    });

    expect(describeClientIssue(new ApiError('CSRF token mismatch', 419))).toMatchObject({
      severity: 'warning',
      technicalCode: 'SESSION_EXPIRED',
      message: expect.stringMatching(/vuelva a iniciar sesion/i),
    });

    expect(describeClientIssue(new ApiError('Forbidden', 403))).toMatchObject({
      severity: 'warning',
      technicalCode: 'HTTP_403',
      message: PERMISSION_DENIED_MESSAGE,
    });

    expect(describeClientIssue(new ApiError('Server exploded', 500))).toMatchObject({
      severity: 'error',
      technicalCode: 'HTTP_500',
    });
  });

  it('redacts sensitive words from logged messages', () => {
    expect(sanitizeClientMessage('DB_PASSWORD=secret token=abc')).not.toMatch(/secret|token/i);
    expect(sanitizeClientMessage('contraseña=secret')).not.toMatch(/contraseña|secret/i);
  });
});
