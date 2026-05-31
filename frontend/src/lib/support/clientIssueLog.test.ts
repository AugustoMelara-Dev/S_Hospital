import { describe, expect, it } from 'vitest';
import { getClientIssues, logClientIssue, safeClientMessage } from './clientIssueLog';

describe('clientIssueLog', () => {
  it('redacts sensitive words from support messages', () => {
    expect(safeClientMessage('DB_PASSWORD=secret token=abc')).not.toMatch(/secret|token/i);
    expect(safeClientMessage('contraseña=secret')).not.toMatch(/contraseña|secret/i);
  });

  it('returns safe stored incidents for support', () => {
    window.localStorage.clear();

    logClientIssue(new Error('No se pudo conectar DB_PASSWORD=secret'), {
      action: 'GET /api/health',
      module: 'api',
      route: '/help',
    });

    expect(getClientIssues()[0]).toMatchObject({
      action: 'GET /api/health',
      module: 'api',
      route: '/help',
      technical_code: 'Error',
    });
    expect(getClientIssues()[0].safe_message).not.toMatch(/DB_PASSWORD|secret/i);
  });
});
