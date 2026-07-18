import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { COLOR_THEMES, useTheme } from './useTheme';

const LIGHT_BACKGROUND = '#f8fafc';
const DARK_BACKGROUND = '#0f172a';

describe('institutional color themes', () => {
  beforeEach(() => localStorage.clear());

  it('falls back safely when persisted branding is invalid', () => {
    localStorage.setItem('hospital-billing-color-theme', 'yellow-low-contrast');

    const { result } = renderHook(() => useTheme());

    expect(result.current.colorTheme).toBe('teal');
  });

  it.each(Object.entries(COLOR_THEMES))('%s keeps primary controls at WCAG AA contrast', (_name, palette) => {
    expect(contrastRatio(palette.light.secondary, LIGHT_BACKGROUND)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(palette.dark.secondary, DARK_BACKGROUND)).toBeGreaterThanOrEqual(4.5);
  });

  it('applies the local dark class and semantic variables without Ant Design', async () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setTheme('dark'));

    await waitFor(() => {
      expect(document.documentElement).toHaveClass('dark');
      expect(document.documentElement.style.getPropertyValue('--institutional-primary-foreground')).toBe(DARK_BACKGROUND);
    });
  });

  it('uses the accessible light palette for sidebar indicators in light mode', async () => {
    renderHook(() => useTheme());

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--institutional-sidebar-primary'))
        .toBe(COLOR_THEMES.teal.light.ring);
    });
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
