import { useCallback, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';
export type ColorTheme = 'teal' | 'blue' | 'green' | 'indigo' | 'rose';

const THEME_KEY = 'hospital-billing-theme';
const COLOR_KEY = 'hospital-billing-color-theme';

export const COLOR_THEMES: Record<ColorTheme, {
  name: string;
  light: { secondary: string; ring: string; accent: string; accentForeground: string };
  dark: { secondary: string; ring: string; accent: string; accentForeground: string };
}> = {
  teal: {
    name: 'Verde clínico',
    light: { secondary: '#0d9488', ring: '#0d9488', accent: '#f0fdfa', accentForeground: '#0d9488' },
    dark: { secondary: '#14b8a6', ring: '#14b8a6', accent: '#042f2e', accentForeground: '#14b8a6' },
  },
  blue: {
    name: 'Azul Médico',
    light: { secondary: '#0284c7', ring: '#0284c7', accent: '#f0f9ff', accentForeground: '#0284c7' },
    dark: { secondary: '#38bdf8', ring: '#38bdf8', accent: '#082f49', accentForeground: '#38bdf8' },
  },
  green: {
    name: 'Verde Salud',
    light: { secondary: '#059669', ring: '#059669', accent: '#ecfdf5', accentForeground: '#059669' },
    dark: { secondary: '#10b981', ring: '#10b981', accent: '#064e3b', accentForeground: '#10b981' },
  },
  indigo: {
    name: 'Índigo institucional',
    light: { secondary: '#4f46e5', ring: '#4f46e5', accent: '#e0e7ff', accentForeground: '#4f46e5' },
    dark: { secondary: '#6366f1', ring: '#6366f1', accent: '#312e81', accentForeground: '#6366f1' },
  },
  rose: {
    name: 'Vino Premium',
    light: { secondary: '#be123c', ring: '#be123c', accent: '#fff1f2', accentForeground: '#be123c' },
    dark: { secondary: '#fb7185', ring: '#fb7185', accent: '#4c0519', accentForeground: '#fb7185' },
  },
};

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light';
    return (localStorage.getItem(THEME_KEY) as Theme) || 'light';
  });

  const [colorTheme, setColorThemeState] = useState<ColorTheme>(() => {
    if (typeof window === 'undefined') return 'teal';
    return (localStorage.getItem(COLOR_KEY) as ColorTheme) || 'teal';
  });

  const isDark = theme === 'dark' || (theme === 'system' && getSystemTheme() === 'dark');

  // Apply theme & color theme values to document element
  useEffect(() => {
    const root = document.documentElement;
    
    // 1. Apply dark class
    root.classList.toggle('dark', isDark);

    // 2. Apply theme color variables
    const config = COLOR_THEMES[colorTheme][isDark ? 'dark' : 'light'];
    root.style.setProperty('--color-secondary', config.secondary);
    root.style.setProperty('--color-ring', config.ring);
    root.style.setProperty('--color-accent', config.accent);
    root.style.setProperty('--color-accent-foreground', config.accentForeground);

    // Sidebar indicators / highlights
    root.style.setProperty('--color-sidebar-primary', config.secondary);
    root.style.setProperty('--color-sidebar-ring', config.ring);
  }, [theme, colorTheme, isDark]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_KEY, newTheme);
  }, []);

  const setColorTheme = useCallback((newColor: ColorTheme) => {
    setColorThemeState(newColor);
    localStorage.setItem(COLOR_KEY, newColor);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(isDark ? 'light' : 'dark');
  }, [isDark, setTheme]);

  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      document.documentElement.classList.toggle('dark', getSystemTheme() === 'dark');
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  return {
    theme,
    setTheme,
    toggleTheme,
    isDark,
    colorTheme,
    setColorTheme,
  } as const;
}
