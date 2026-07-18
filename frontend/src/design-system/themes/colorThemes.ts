export type ColorTheme = 'teal' | 'blue' | 'green' | 'indigo' | 'rose';

export const DEFAULT_COLOR_THEME: ColorTheme = 'teal';

export const THEME_SEMANTICS = {
  dark: { primaryForeground: '#0f172a', secondary: '#cbd5e1' },
  light: { primaryForeground: '#ffffff', secondary: '#475569' },
} as const;

export const COLOR_THEMES: Record<ColorTheme, {
  name: string;
  light: { secondary: string; ring: string; accent: string; accentForeground: string };
  dark: { secondary: string; ring: string; accent: string; accentForeground: string };
}> = {
  teal: {
    name: 'Verde clínico',
    light: { secondary: '#0f766e', ring: '#0f766e', accent: '#ecfdf5', accentForeground: '#0f766e' },
    dark: { secondary: '#2dd4bf', ring: '#5eead4', accent: '#134e4a', accentForeground: '#ccfbf1' },
  },
  blue: {
    name: 'Azul Médico',
    light: { secondary: '#0369a1', ring: '#0369a1', accent: '#f0f9ff', accentForeground: '#0369a1' },
    dark: { secondary: '#7dd3fc', ring: '#bae6fd', accent: '#0c4a6e', accentForeground: '#e0f2fe' },
  },
  green: {
    name: 'Verde Salud',
    light: { secondary: '#047857', ring: '#047857', accent: '#ecfdf5', accentForeground: '#047857' },
    dark: { secondary: '#34d399', ring: '#6ee7b7', accent: '#065f46', accentForeground: '#d1fae5' },
  },
  indigo: {
    name: 'Índigo institucional',
    light: { secondary: '#4338ca', ring: '#4338ca', accent: '#e0e7ff', accentForeground: '#4338ca' },
    dark: { secondary: '#a5b4fc', ring: '#c7d2fe', accent: '#3730a3', accentForeground: '#eef2ff' },
  },
  rose: {
    name: 'Vino Premium',
    light: { secondary: '#be123c', ring: '#be123c', accent: '#fff1f2', accentForeground: '#be123c' },
    dark: { secondary: '#fda4af', ring: '#fecdd3', accent: '#881337', accentForeground: '#ffe4e6' },
  },
};

export function normalizeColorTheme(value: unknown): ColorTheme {
  return typeof value === 'string' && value in COLOR_THEMES
    ? value as ColorTheme
    : DEFAULT_COLOR_THEME;
}
