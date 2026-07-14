import { ConfigProvider, App as AntApp } from 'antd';
import esES from 'antd/locale/es_ES';
import { type ReactNode, useMemo } from 'react';
import { useTheme, COLOR_THEMES } from '../../hooks/useTheme';
import { createInstitutionalTheme } from '../themes/institutionalTheme';

interface DesignSystemProviderProps {
  children: ReactNode;
  compact?: boolean;
}

export function DesignSystemProvider({ children, compact = false }: DesignSystemProviderProps) {
  const { isDark, colorTheme } = useTheme();

  const themeConfig = useMemo(() => createInstitutionalTheme({
    compact,
    mode: isDark ? 'dark' : 'light',
    primaryColor: COLOR_THEMES[colorTheme][isDark ? 'dark' : 'light'].secondary,
  }), [compact, isDark, colorTheme]);

  return (
    <ConfigProvider
      locale={esES}
      theme={themeConfig}
      getPopupContainer={() => document.body}
    >
      <AntApp>
        {children}
      </AntApp>
    </ConfigProvider>
  );
}
