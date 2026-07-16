import { describe, expect, it } from 'vitest';
import { normalizeOperationalStatus } from './operationalStatus';

describe('normalizeOperationalStatus', () => {
  it('conserva la severidad explícita sin inferirla desde el texto', () => {
    expect(normalizeOperationalStatus({
      key: 'services-timeout',
      level: 'error',
      message: "La operación 'GET /api/services' excedió 10s.",
    })).toEqual({
      key: 'services-timeout',
      level: 'error',
      message: "La operación 'GET /api/services' excedió 10s.",
      toast: true,
    });
  });

  it('rechaza mensajes sin severidad explícita en vez de inferirla por su texto', () => {
    expect(() => normalizeOperationalStatus(
      "La operación 'GET /api/services' excedió 10s." as never,
    )).toThrow(/severidad explícita/i);
  });

  it('permite mantener feedback exclusivamente contextual', () => {
    expect(normalizeOperationalStatus({
      level: 'warning',
      message: 'Revise la caja antes de continuar.',
      toast: false,
    })).toMatchObject({ level: 'warning', toast: false });
  });
});
