import { theme, type ThemeConfig } from 'antd';

export type InstitutionalColorMode = 'light' | 'dark';

export const institutionalZIndex = {
  base: 0,
  sticky: 100,
  dropdown: 1050,
  modal: 1100,
  drawer: 1150,
  notification: 1200,
  tooltip: 1250,
} as const;

const zeroRadius = {
  borderRadius: 0,
  borderRadiusLG: 0,
  borderRadiusOuter: 0,
  borderRadiusSM: 0,
  borderRadiusXS: 0,
};

const flatComponentTokens: NonNullable<ThemeConfig['components']> = {
  Alert: { borderRadiusLG: 0 },
  Button: { borderRadius: 0 },
  Card: { borderRadiusLG: 0, boxShadow: 'none' },
  Checkbox: { borderRadiusSM: 0 },
  DatePicker: { borderRadius: 0 },
  Drawer: { zIndexPopup: institutionalZIndex.drawer },
  Dropdown: { borderRadiusLG: 0, zIndexPopup: institutionalZIndex.dropdown },
  Input: { borderRadius: 0 },
  InputNumber: { borderRadius: 0 },
  Menu: { itemBorderRadius: 0, subMenuItemBorderRadius: 0 },
  Message: { zIndexPopup: institutionalZIndex.notification },
  Modal: { borderRadiusLG: 0, zIndexPopupBase: institutionalZIndex.modal },
  Notification: { borderRadiusLG: 0, zIndexPopup: institutionalZIndex.notification },
  Popover: { borderRadiusLG: 0, zIndexPopup: institutionalZIndex.dropdown },
  Select: { borderRadius: 0 },
  Table: { borderRadius: 0, headerBorderRadius: 0 },
  Tag: { borderRadiusSM: 0 },
  Tooltip: { borderRadius: 0, zIndexPopup: institutionalZIndex.tooltip },
};

export function createInstitutionalTheme({ mode, compact, primaryColor }: {
  mode: InstitutionalColorMode;
  compact: boolean;
  primaryColor?: string;
}): ThemeConfig {
  const isDark = mode === 'dark';
  const resolvedPrimary = primaryColor ?? (isDark ? '#14b8a6' : '#0f766e');
  const semantic = isDark ? {
    background: '#0f172a',
    container: '#1e293b',
    elevated: '#273449',
    text: '#f8fafc',
    textSecondary: '#cbd5e1',
    textTertiary: '#b6c2d2',
    border: '#64748b',
    borderSecondary: '#475569',
    primaryForeground: '#0f172a',
    primaryBackground: '#134e4a',
    successBackground: '#14532d',
    successText: '#dcfce7',
    warningBackground: '#78350f',
    warningText: '#fef3c7',
    errorBackground: '#7f1d1d',
    errorText: '#fee2e2',
    infoBackground: '#0c4a6e',
    infoText: '#e0f2fe',
  } : {
    background: '#f8fafc',
    container: '#ffffff',
    elevated: '#ffffff',
    text: '#172033',
    textSecondary: '#475569',
    textTertiary: '#596579',
    border: '#94a3b8',
    borderSecondary: '#cbd5e1',
    primaryForeground: '#ffffff',
    primaryBackground: '#ccfbf1',
    successBackground: '#dcfce7',
    successText: '#166534',
    warningBackground: '#fef3c7',
    warningText: '#92400e',
    errorBackground: '#fee2e2',
    errorText: '#991b1b',
    infoBackground: '#e0f2fe',
    infoText: '#075985',
  };

  return {
    algorithm: compact
      ? [isDark ? theme.darkAlgorithm : theme.defaultAlgorithm, theme.compactAlgorithm]
      : [isDark ? theme.darkAlgorithm : theme.defaultAlgorithm],
    cssVar: { key: 's-hospital' },
    hashed: true,
    token: {
      ...zeroRadius,
      colorBgBase: semantic.background,
      colorBgContainer: semantic.container,
      colorBgElevated: semantic.elevated,
      colorBorder: semantic.border,
      colorBorderSecondary: semantic.borderSecondary,
      colorError: isDark ? '#fca5a5' : '#b91c1c',
      colorInfo: isDark ? '#bae6fd' : '#0369a1',
      colorPrimary: resolvedPrimary,
      colorPrimaryBg: semantic.primaryBackground,
      colorPrimaryText: resolvedPrimary,
      colorText: semantic.text,
      colorTextBase: semantic.text,
      colorTextLightSolid: semantic.primaryForeground,
      colorTextSecondary: semantic.textSecondary,
      colorTextTertiary: semantic.textTertiary,
      colorLink: resolvedPrimary,
      colorLinkHover: resolvedPrimary,
      colorLinkActive: resolvedPrimary,
      colorSuccessBg: semantic.successBackground,
      colorSuccessText: semantic.successText,
      colorWarningBg: semantic.warningBackground,
      colorWarningText: semantic.warningText,
      colorErrorBg: semantic.errorBackground,
      colorErrorText: semantic.errorText,
      colorInfoBg: semantic.infoBackground,
      colorInfoText: semantic.infoText,
      colorSuccess: isDark ? '#86efac' : '#15803d',
      colorWarning: isDark ? '#fde68a' : '#b45309',
      controlHeight: compact ? 28 : 32,
      fontFamily: '"IBM Plex Sans Variable", system-ui, -apple-system, sans-serif',
      motion: false,
      motionDurationFast: '0s',
      motionDurationMid: '0s',
      motionDurationSlow: '0s',
      padding: compact ? 8 : 12,
      zIndexPopupBase: institutionalZIndex.dropdown,
    },
    components: flatComponentTokens,
  };
}
