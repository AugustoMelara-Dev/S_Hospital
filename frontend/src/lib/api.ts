const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? '';

export const apiClient = {
  baseUrl: configuredBaseUrl.replace(/\/$/, ''),

  url(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${normalizedPath}`;
  },
};

