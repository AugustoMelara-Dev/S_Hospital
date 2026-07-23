import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import './printing/styles/receipt-print.css';

const DEVELOPMENT_CLEANUP_KEY = 's-hospital-development-cache-cleaned';

async function prepareDevelopmentRuntime(): Promise<boolean> {
  if (typeof window === 'undefined' || import.meta.env.PROD) return true;

  try {
    const wasControlled = Boolean(navigator.serviceWorker?.controller);

    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith('s-hospital-'))
          .map((cacheName) => caches.delete(cacheName)),
      );
    }

    if (wasControlled && sessionStorage.getItem(DEVELOPMENT_CLEANUP_KEY) !== 'true') {
      sessionStorage.setItem(DEVELOPMENT_CLEANUP_KEY, 'true');
      window.location.reload();
      return false;
    }

    sessionStorage.removeItem(DEVELOPMENT_CLEANUP_KEY);
  } catch (error) {
    console.warn('Stale service worker cleanup failed', error);
  }

  return true;
}

function registerServiceWorker() {
  if (typeof window === 'undefined' || !import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      // Service worker is best-effort; do not crash the app on registration error.
      console.warn('Service worker registration failed', error);
    });
  });
}

async function bootstrap() {
  if (!(await prepareDevelopmentRuntime())) return;

  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

  registerServiceWorker();
}

void bootstrap();
