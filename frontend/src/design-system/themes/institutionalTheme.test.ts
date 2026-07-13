import { describe, expect, it } from 'vitest';
import { createInstitutionalTheme, institutionalZIndex } from './institutionalTheme';

describe('institutional theme', () => {
  it.each(['light', 'dark'] as const)('forces zero radius for the %s theme', (mode) => {
    const config = createInstitutionalTheme({ mode, compact: false });

    expect(config.token).toMatchObject({
      borderRadius: 0,
      borderRadiusLG: 0,
      borderRadiusOuter: 0,
      borderRadiusSM: 0,
      borderRadiusXS: 0,
    });
    expect(config.components?.Modal).toMatchObject({ borderRadiusLG: 0, zIndexPopupBase: institutionalZIndex.modal });
    expect(config.components?.Drawer).toMatchObject({ zIndexPopup: institutionalZIndex.drawer });
    expect(config.components?.Notification).toMatchObject({ zIndexPopup: institutionalZIndex.notification });
  });

  it('adds compact density only when requested', () => {
    const regular = createInstitutionalTheme({ mode: 'light', compact: false });
    const compact = createInstitutionalTheme({ mode: 'light', compact: true });

    expect(regular.token?.controlHeight).toBe(32);
    expect(compact.token?.controlHeight).toBe(28);
    expect(compact.token?.padding).toBeLessThan(regular.token?.padding as number);
    expect(compact.algorithm).toHaveLength(2);
  });

  it('disables decorative motion through theme tokens', () => {
    const config = createInstitutionalTheme({ mode: 'light', compact: false });

    expect(config.token).toMatchObject({ motion: false, motionDurationFast: '0s', motionDurationMid: '0s', motionDurationSlow: '0s' });
  });

  it.each(['light', 'dark'] as const)('defines accessible semantic text and status tokens for %s', (mode) => {
    const config = createInstitutionalTheme({ mode, compact: false });

    expect(config.token).toMatchObject({
      colorText: expect.any(String),
      colorTextSecondary: expect.any(String),
      colorTextTertiary: expect.any(String),
      colorPrimaryText: expect.any(String),
      colorBgContainer: expect.any(String),
      colorBgElevated: expect.any(String),
      colorBorder: expect.any(String),
      colorBorderSecondary: expect.any(String),
    });
    expect(config.components?.Tag).toMatchObject({ borderRadiusSM: 0 });
  });
});
