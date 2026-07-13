import { useCallback, useEffect, useState } from 'react';
import { COLOR_THEMES, normalizeColorTheme, type ColorTheme } from '../design-system/themes/colorThemes';

export { COLOR_THEMES, type ColorTheme } from '../design-system/themes/colorThemes';

type Theme = 'light' | 'dark' | 'system';

const THEME_KEY = 'hospital-billing-theme';
const COLOR_KEY = 'hospital-billing-color-theme';

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
    return normalizeColorTheme(localStorage.getItem(COLOR_KEY));
  });

  const isDark = theme === 'dark' || (theme === 'system' && getSystemTheme() === 'dark');

  // Apply theme & color theme values to document element
  useEffect(() => {
    const root = document.documentElement;

    // 1. Apply dark class
    root.classList.toggle('dark', isDark);

    // 2. Apply theme color variables
    const config = COLOR_THEMES[colorTheme][isDark ? 'dark' : 'light'];
    root.style.setProperty('--institutional-primary', config.secondary);
    root.style.setProperty('--institutional-primary-foreground', isDark ? '#0f172a' : '#ffffff');
    root.style.setProperty('--institutional-secondary', isDark ? '#cbd5e1' : '#475569');
    root.style.setProperty('--institutional-accent', config.accent);
    root.style.setProperty('--institutional-accent-foreground', config.accentForeground);

    // Sidebar indicators / highlights
    root.style.setProperty('--institutional-sidebar-primary', isDark ? config.ring : lightenForDarkRail(config.secondary));
    root.style.setProperty('--institutional-sidebar-ring', isDark ? config.ring : lightenForDarkRail(config.secondary));
  }, [theme, colorTheme, isDark]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_KEY, newTheme);
  }, []);

  const setColorTheme = useCallback((newColor: ColorTheme) => {
    const safeColor = normalizeColorTheme(newColor);
    setColorThemeState(safeColor);
    localStorage.setItem(COLOR_KEY, safeColor);
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

function lightenForDarkRail(color: string) {
  const accessibleRailColors: Record<string, string> = {
    '#0f766e': '#5eead4',
    '#0369a1': '#7dd3fc',
    '#047857': '#6ee7b7',
    '#4338ca': '#a5b4fc',
    '#be123c': '#fda4af',
  };
  return accessibleRailColors[color] ?? '#e2e8f0';
}
