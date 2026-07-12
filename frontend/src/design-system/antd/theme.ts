import { type ThemeConfig, theme } from 'antd';

export const commonThemeTokens = {
  borderRadius: 0,
  borderRadiusSM: 0,
  borderRadiusLG: 0,
  borderRadiusXS: 0,
  borderRadiusOuter: 0,
  fontFamily: '"IBM Plex Sans Variable", system-ui, -apple-system, sans-serif',
  controlHeight: 32,
};

export const institutionalLightTheme: ThemeConfig = {
  algorithm: [theme.defaultAlgorithm],
  token: {
    ...commonThemeTokens,
    colorPrimary: '#0284c7', // Azul Médico
    colorSuccess: '#16a34a',
    colorWarning: '#d97706',
    colorError: '#dc2626',
    colorTextBase: '#172033',
    colorBgBase: '#f8fafc',
  },
  components: {
    Button: { borderRadius: 0, controlHeight: 32 },
    Input: { borderRadius: 0, controlHeight: 32 },
    Select: { borderRadius: 0, controlHeight: 32 },
    Table: { borderRadius: 0 },
    Modal: { borderRadiusLG: 0 },
    Drawer: { borderRadiusLG: 0 },
    Card: { borderRadiusLG: 0 },
    Tag: { borderRadiusSM: 0 },
  }
};

export const institutionalDarkTheme: ThemeConfig = {
  algorithm: [theme.darkAlgorithm],
  token: {
    ...commonThemeTokens,
    colorPrimary: '#38bdf8', // Azul Médico Claro (contraste oscuro)
    colorSuccess: '#22c55e',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorTextBase: '#f8fafc',
    colorBgBase: '#0f172a',
  },
  components: {
    Button: { borderRadius: 0, controlHeight: 32 },
    Input: { borderRadius: 0, controlHeight: 32 },
    Select: { borderRadius: 0, controlHeight: 32 },
    Table: { borderRadius: 0 },
    Modal: { borderRadiusLG: 0 },
    Drawer: { borderRadiusLG: 0 },
    Card: { borderRadiusLG: 0 },
    Tag: { borderRadiusSM: 0 },
  }
};
