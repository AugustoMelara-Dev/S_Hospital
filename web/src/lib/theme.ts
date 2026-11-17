import { useCallback, useSyncExternalStore } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';
const KEY = 'shs-theme';
const listeners = new Set<() => void>();

function read(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

/** Applies the theme without a page-wide transition smear (better-ui). */
export function applyTheme(pref: ThemePref): void {
  const root = document.documentElement;
  root.classList.add('theme-switching');
  if (pref === 'system') delete root.dataset.theme;
  else root.dataset.theme = pref;
  void root.offsetHeight; // force reflow
  requestAnimationFrame(() => root.classList.remove('theme-switching'));
}

export function setTheme(pref: ThemePref): void {
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    /* storage unavailable: still apply for this tab */
  }
  applyTheme(pref);
  listeners.forEach((l) => l());
}

export function useTheme(): [ThemePref, (t: ThemePref) => void] {
  const pref = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => 'system' as ThemePref,
  );
  const set = useCallback((t: ThemePref) => setTheme(t), []);
  return [pref, set];
}
