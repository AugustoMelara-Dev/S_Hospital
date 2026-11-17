import type { QuickService } from './types';

/**
 * "Accesos rápidos": the concepts this workstation adds most often (per browser).
 * There is no API for favourites; prices are display-only — totals always come
 * from the server preview.
 */
const STORAGE_KEY = 'shs:cobrar:frecuentes';
const MAX_STORED = 30;

type Entry = { service: QuickService; count: number; at: number };

function read(): Entry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Entry[]).filter((e) => e && e.service && typeof e.service.id === 'number') : [];
  } catch {
    return [];
  }
}

export function frequentServices(limit = 8): QuickService[] {
  return read()
    .sort((a, b) => b.count - a.count || b.at - a.at)
    .slice(0, limit)
    .map((e) => e.service);
}

export function recordServiceUse(service: QuickService): void {
  try {
    const list = read();
    const found = list.find((e) => e.service.id === service.id);
    if (found) {
      found.count += 1;
      found.at = Date.now();
      found.service = service;
    } else {
      list.push({ service, count: 1, at: Date.now() });
    }
    list.sort((a, b) => b.count - a.count || b.at - a.at);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_STORED)));
  } catch {
    /* storage unavailable: quick access is a convenience only */
  }
}

