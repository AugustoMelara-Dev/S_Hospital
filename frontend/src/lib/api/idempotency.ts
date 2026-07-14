import type { MutableRefObject } from 'react';
import { createClientIdempotencyKey } from './base';

export function payloadScopedIdempotencyKey(
  keyRef: MutableRefObject<string | null>,
  signatureRef: MutableRefObject<string | null>,
  payload: unknown,
): string {
  const signature = JSON.stringify(payload);

  if (!keyRef.current || signatureRef.current !== signature) {
    keyRef.current = createClientIdempotencyKey();
    signatureRef.current = signature;
  }

  return keyRef.current;
}

export function resetPayloadScopedIdempotencyKey(
  keyRef: MutableRefObject<string | null>,
  signatureRef: MutableRefObject<string | null>,
): void {
  keyRef.current = null;
  signatureRef.current = null;
}
