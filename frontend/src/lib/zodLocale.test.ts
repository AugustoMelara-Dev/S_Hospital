import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import './zodLocale';

describe('zodLocale', () => {
  it('muestra en español los mensajes por defecto de validación', () => {
    const result = z.object({ orden: z.number().int().min(0) }).safeParse({ orden: -1 });

    expect(result.success).toBe(false);
    const message = result.error?.issues[0]?.message ?? '';
    expect(message).not.toMatch(/too small|expected|must be|greater/i);
    expect(message).toMatch(/demasiado pequeño|mayor|>=/i);
  });
});
