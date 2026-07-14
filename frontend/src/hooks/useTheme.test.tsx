import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { COLOR_THEMES, useTheme } from './useTheme';
import { institutionalDarkTheme, institutionalLightTheme } from '../design-system/antd/theme';

describe('institutional color themes', () => {
  beforeEach(() => localStorage.clear());

  it('falls back safely when persisted branding is invalid', () => {
    localStorage.setItem('hospital-billing-color-theme', 'yellow-low-contrast');

    const { result } = renderHook(() => useTheme());

    expect(result.current.colorTheme).toBe('teal');
  });

  it.each(Object.entries(COLOR_THEMES))('%s keeps primary controls at WCAG AA contrast', (_name, palette) => {
    expect(contrastRatio(palette.light.secondary, String(institutionalLightTheme.token?.colorBgBase))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(palette.dark.secondary, String(institutionalDarkTheme.token?.colorBgBase))).toBeGreaterThanOrEqual(4.5);
  });
});

function contrastRatio(foreground: string, background: string) {
  const luminance = (hex: string) => {
    const channels = hex.match(/[a-f\d]{2}/gi)?.map((channel) => Number.parseInt(channel, 16) / 255) ?? [];
    const [red, green, blue] = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
