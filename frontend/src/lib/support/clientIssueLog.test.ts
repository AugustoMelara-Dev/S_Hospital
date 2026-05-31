import { describe, expect, it } from 'vitest';
import { safeClientMessage } from './clientIssueLog';

describe('clientIssueLog', () => {
  it('redacts sensitive words from support messages', () => {
    expect(safeClientMessage('DB_PASSWORD=secret token=abc')).not.toMatch(/secret|token/i);
    expect(safeClientMessage('contraseña=secret')).not.toMatch(/contraseña|secret/i);
  });
});
