/**
 * Señal de entorno para decisiones que el servidor aplica solo en producción
 * (DECISIONES.md #13: la tasa por defecto `origin=code_default` bloquea la
 * emisión únicamente con `APP_ENV=production`).
 *
 * El POS no recibe `APP_ENV` del servidor en la respuesta de prevalidación, así
 * que usa la mejor señal disponible: el build de producción desplegado
 * (`import.meta.env.PROD`). El servidor de desarrollo de laboratorio no es un
 * build de producción, por lo que allí el aviso se muestra sin bloquear.
 *
 * Cuando el servidor exponga `app_env` de forma explícita (p. ej. en la
 * prevalidación), esta función debe consumirlo y el fallback por build queda
 * solo como red de seguridad. No se inventa una política fiscal.
 */
export type RuntimeEnvironmentSignal = {
  /** `APP_ENV` reportado por el servidor, si está disponible. */
  appEnv: string | null;
  /** `true` cuando el frontend corre desde un build de producción. */
  productionBuild: boolean;
};

export function normalizeAppEnv(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  return normalized === '' ? null : normalized;
}

/**
 * Es producción cuando el servidor lo confirma. Si no hay señal del servidor,
 * se usa el build desplegado como aproximación (un hospital no opera con el
 * servidor de desarrollo).
 */
export function isProductionEnvironment(signal: RuntimeEnvironmentSignal): boolean {
  const appEnv = normalizeAppEnv(signal.appEnv);

  if (appEnv !== null) {
    return appEnv === 'production';
  }

  return signal.productionBuild;
}

export function currentRuntimeEnvironment(appEnv: string | null = null): RuntimeEnvironmentSignal {
  return {
    appEnv: normalizeAppEnv(appEnv),
    productionBuild: import.meta.env.PROD,
  };
}
