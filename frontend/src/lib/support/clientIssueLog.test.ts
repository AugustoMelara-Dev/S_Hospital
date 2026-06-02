import { describe, expect, it } from 'vitest';
import { buildClientIssueSupportSummary, getClientIssues, logClientIssue, safeClientMessage } from './clientIssueLog';

describe('clientIssueLog', () => {
  it('redacts sensitive words from support messages', () => {
    expect(safeClientMessage('DB_PASSWORD=secret token=abc')).not.toMatch(/secret|token/i);
    expect(safeClientMessage('contraseña=secret')).not.toMatch(/contraseña|secret/i);
    expect(safeClientMessage('Revise C:\\Users\\admin\\hospital\\.env')).not.toMatch(/C:\\Users|\.env/i);
  });

  it('redacts internal field names and runtime details from support messages', () => {
    const message = safeClientMessage(
      'cash_session_id SQLSTATE[23000]: duplicate key in storage/logs/laravel.log and /var/www/html/.env',
    );

    expect(message).toMatch(/\[campo-interno\]/);
    expect(message).toMatch(/\[detalle-tecnico\]/);
    expect(message).toMatch(/\[ruta-local\]/);
    expect(message).not.toMatch(/cash_session_id|SQLSTATE|storage\/logs|\/var\/www|\.env/i);
  });

  it('removes URL credentials from support messages', () => {
    const message = safeClientMessage(
      'No abre http://soporte:clave-secreta@192.168.1.10:8000/api/system/status',
    );

    expect(message).toContain('http://192.168.1.10:8000/api/system/status');
    expect(message).not.toMatch(/soporte|clave-secreta|@192\.168\.1\.10/i);
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

  it('builds a limited support summary without secrets or local paths', () => {
    const summary = buildClientIssueSupportSummary([
      {
        action: 'GET /api/health',
        module: 'api',
        route: '/help',
        safe_message: 'No se pudo conectar DB_PASSWORD=secret token=abc en C:\\Users\\admin\\hospital\\.env cash_session_id SQLSTATE[HY000]: trace',
        technical_code: 'cash_session_id',
        occurred_at: '2026-05-31T12:00:00.000Z',
      },
      {
        action: 'POST /api/invoices',
        module: 'billing',
        route: '/billing',
        safe_message: 'Caja cerrada',
        technical_code: 'CashSessionClosed',
        occurred_at: '2026-05-31T12:01:00.000Z',
      },
      {
        action: 'POST /api/backups',
        module: 'backups',
        route: '/backups',
        safe_message: 'Respaldo fallido',
        technical_code: 'BackupFailed',
        occurred_at: '2026-05-31T12:02:00.000Z',
      },
      {
        action: 'GET /api/reports',
        module: 'reports',
        route: '/reports',
        safe_message: 'No debe aparecer',
        technical_code: 'Unexpected',
        occurred_at: '2026-05-31T12:03:00.000Z',
      },
    ], {
      app_origin: 'http://192.168.1.10',
      current_route: '/help',
      generated_at: '2026-05-31T12:05:00.000Z',
    });

    expect(summary).toContain('Resumen seguro para soporte');
    expect(summary).toContain('Incidentes guardados en este navegador: 4');
    expect(summary).toContain('Caja cerrada');
    expect(summary).not.toMatch(/DB_PASSWORD|secret|token|abc|C:\\Users|\.env|cash_session_id|SQLSTATE/i);
    expect(summary).not.toContain('No debe aparecer');
  });
});
