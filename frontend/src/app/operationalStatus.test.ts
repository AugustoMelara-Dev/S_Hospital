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

  it('trata mensajes legacy desconocidos como información, nunca como éxito', () => {
    expect(normalizeOperationalStatus("La operación 'GET /api/services' excedió 10s.")).toMatchObject({
      level: 'info',
      message: "La operación 'GET /api/services' excedió 10s.",
    });
  });

  it('permite mantener feedback exclusivamente contextual', () => {
    expect(normalizeOperationalStatus({
      level: 'warning',
      message: 'Revise la caja antes de continuar.',
      toast: false,
    })).toMatchObject({ level: 'warning', toast: false });
  });
});
