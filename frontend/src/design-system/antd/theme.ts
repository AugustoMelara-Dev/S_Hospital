import { createInstitutionalTheme } from '../themes/institutionalTheme';

export const commonThemeTokens = createInstitutionalTheme({ mode: 'light', compact: false }).token;
export const institutionalLightTheme = createInstitutionalTheme({ mode: 'light', compact: false });
export const institutionalDarkTheme = createInstitutionalTheme({ mode: 'dark', compact: false });
