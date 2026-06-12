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
    const inFlight = fetch(apiClient.url('/api/system/echo-config'), {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw response;
        }

        const payload = await response.json() as { data?: EchoConfig | null };
        return (payload?.data ?? null) as EchoConfig | null;
      })
      .catch((error) => {
        // Reset the promise so a later call retries fetching the
        // config. Without this, a transient failure (e.g. the LAN
        // server rebooting) would pin `configPromise` to the rejected
        // promise forever and broadcasting would stay disabled.
        configPromise = null;
        if (!isExpectedEchoBootstrapFailure(error) && import.meta.env.DEV) {
          console.info('[echo] realtime disabled for this session');
        }

        return null;
      });
    configPromise = inFlight;
  }
  try {
    configCache = await configPromise;
  } catch {
    configCache = null;
    configPromise = null;
  }

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

function isExpectedEchoBootstrapFailure(error: unknown): boolean {
  return error instanceof Response
    && (error.status === 401 || error.status === 403 || error.status === 419 || error.status >= 500);
}
