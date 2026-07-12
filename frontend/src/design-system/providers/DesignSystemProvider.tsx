import { ConfigProvider, App, theme as antdTheme } from 'antd';
import esES from 'antd/locale/es_ES';
import { type ReactNode, useMemo } from 'react';
import { useTheme, COLOR_THEMES } from '../../hooks/useTheme';
import { commonThemeTokens } from '../antd/theme';

interface DesignSystemProviderProps {
  children: ReactNode;
}

export function DesignSystemProvider({ children }: DesignSystemProviderProps) {
  const { isDark, colorTheme } = useTheme();

  const themeConfig = useMemo(() => {
    const config = COLOR_THEMES[colorTheme][isDark ? 'dark' : 'light'];
    
    return {
      algorithm: isDark ? [antdTheme.darkAlgorithm] : [antdTheme.defaultAlgorithm],
      token: {
        ...commonThemeTokens,
        colorPrimary: config.secondary,
        colorSuccess: '#16a34a',
        colorWarning: '#d97706',
        colorError: '#dc2626',
        colorTextBase: isDark ? '#f8fafc' : '#172033',
        colorBgBase: isDark ? '#0f172a' : '#f8fafc',
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
      },
    };
  }, [isDark, colorTheme]);

  return (
    <ConfigProvider locale={esES} theme={themeConfig}>
      <App>
        {children}
      </App>
    </ConfigProvider>
  );
}
