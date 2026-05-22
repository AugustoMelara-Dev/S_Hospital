import { useEffect, useState } from 'react';
import { apiClient } from '../lib/api/base';

export function useServerStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [checking, setChecking] = useState<boolean>(false);

  useEffect(() => {
    let active = true;

    const checkStatus = async () => {
      if (!active) return;
      setChecking(true);
      try {
        const response = await fetch(apiClient.url('/api/health'), {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Accept': 'application/json',
          },
        });
        if (response.ok) {
          setIsOnline(true);
        } else {
          setIsOnline(false);
        }
      } catch {
        setIsOnline(false);
      } finally {
        if (active) {
          setChecking(false);
          setLastCheck(new Date());
        }
      }
    };

    // Initial check
    checkStatus();

    // Set interval to check every 30 seconds
    const interval = setInterval(checkStatus, 30_000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return { isOnline, lastCheck, checking };
}
