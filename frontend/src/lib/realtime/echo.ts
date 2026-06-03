import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

import { apiClient } from '../api/base';
import type { EchoConfig } from './types';

let echoInstance: Echo<'pusher'> | null = null;
let configCache: EchoConfig | null = null;
let configPromise: Promise<EchoConfig | null> | null = null;

declare global {
  interface Window {
    Pusher?: typeof Pusher;
    Echo?: Echo<'pusher'>;
  }
}

async function fetchEchoConfig(): Promise<EchoConfig | null> {
  if (configCache) return configCache;
  if (!configPromise) {
    configPromise = apiClient
      .request<{ data: EchoConfig }>('/api/system/echo-config')
      .then((res) => (res?.data ?? null) as EchoConfig | null)
      .catch(() => null)
      .finally(() => {
        // Do not reset configPromise; we want concurrent callers to share.
      });
  }
  configCache = await configPromise;
  return configCache;
}

/**
 * Lazily construct the laravel-echo / pusher-js client pointed at the
 * Soketi sidecar. Returns null when broadcasting is disabled (driver
 * 'log' or 'null') so feature components can subscribe to a no-op.
 *
 * The Echo singleton is bound to window.Echo during dev for console
 * debugging only; production does not rely on the global.
 */
export async function getEcho(): Promise<Echo<'pusher'> | null> {
  if (echoInstance) return echoInstance;
  const config = await fetchEchoConfig();
  if (!config || !config.enabled) {
    return null;
  }
  if (typeof window !== 'undefined' && !window.Pusher) {
    window.Pusher = Pusher;
  }
  echoInstance = new Echo<'pusher'>({
    broadcaster: 'pusher',
    key: config.key,
    cluster: config.cluster,
    forceTLS: config.useTLS,
    enabledTransports: ['ws', 'wss'],
    wsHost: config.host,
    wsPort: config.port,
    wssPort: config.port,
    disableStats: true,
    authEndpoint: config.authEndpoint,
    auth: {
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    },
  });
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    window.Echo = echoInstance;
  }
  return echoInstance;
}

export function disconnectEcho(): void {
  if (echoInstance) {
    echoInstance.disconnect();
    echoInstance = null;
  }
  configCache = null;
  configPromise = null;
}
