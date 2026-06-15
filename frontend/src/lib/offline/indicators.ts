// S_Hospital - subagente 30 (Escenario Sin Internet)
// Helpers de UI para mostrar estado offline y mensajes claros
// cuando una funcionalidad no esta disponible sin internet.

export type OfflineFeature =
  | 'realtime_sync'
  | 'remote_backup'
  | 'license_validation'
  | 'remote_support'
  | 'external_font'
  | 'cdn_asset'
  | 'remote_log';

export interface OfflineMessage {
  readonly availableOffline: boolean;
  readonly title: string;
  readonly description: string;
  readonly hint: string;
}

const BASE_HINT = 'Confirme que el servidor local este encendido y la red LAN operativa.';

const MESSAGES: Record<OfflineFeature, OfflineMessage> = {
  realtime_sync: {
    availableOffline: true,
    title: 'Sincronizacion en tiempo real',
    description: 'La sincronizacion entre PCs puede estar lenta sin Soketi activo.',
    hint: 'Las facturas y pagos confirmados se reflejan en todas las PCs al recargar la pantalla.',
  },
  remote_backup: {
    availableOffline: true,
    title: 'Respaldo remoto',
    description: 'Los respaldos se guardan solo en el servidor local.',
    hint: 'Copie periodicamente el archivo .sql.enc a un USB o disco externo.',
  },
  license_validation: {
    availableOffline: true,
    title: 'Validacion de licencia',
    description: 'La validacion se hace contra el archivo de licencia local.',
    hint: 'Si ve errores de licencia, contacte al responsable tecnico del hospital.',
  },
  remote_support: {
    availableOffline: false,
    title: 'Soporte remoto',
    description: 'El soporte remoto por internet no esta disponible en modo offline.',
    hint: 'Contacte al responsable tecnico del hospital por telefono o mensaje.',
  },
  external_font: {
    availableOffline: false,
    title: 'Fuente externa',
    description: 'La aplicacion requiere fuentes externas que no se cargan sin internet.',
    hint: 'Use solo fuentes locales. Avise al responsable tecnico si ve texto cortado o fuentes faltantes.',
  },
  cdn_asset: {
    availableOffline: false,
    title: 'Recurso externo (CDN)',
    description: 'La aplicacion intenta cargar un recurso desde un CDN publico.',
    hint: 'Este modulo no esta disponible sin internet. Avise al responsable tecnico.',
  },
  remote_log: {
    availableOffline: false,
    title: 'Envio de logs',
    description: 'El envio automatico de logs a servicios externos no esta disponible.',
    hint: 'Los logs quedan en el servidor local. Soporte puede revisarlos cuando se restablezca la conexion.',
  },
};

export function getOfflineMessage(feature: OfflineFeature): OfflineMessage {
  return MESSAGES[feature];
}

export function isOfflineAvailable(feature: OfflineFeature): boolean {
  return MESSAGES[feature].availableOffline;
}

export function getAllOfflineMessages(): readonly OfflineMessage[] {
  return Object.values(MESSAGES);
}

export function isNavigatorOffline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return !navigator.onLine;
}

export type OfflineChangeHandler = (offline: boolean) => void;

const handlers = new Set<OfflineChangeHandler>();

function handleOnline(): void {
  for (const h of handlers) h(false);
}

function handleOffline(): void {
  for (const h of handlers) h(true);
}

let listenersRegistered = false;

function ensureListeners(): void {
  if (listenersRegistered) return;
  if (typeof window === 'undefined') return;
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  listenersRegistered = true;
}

export function onOfflineChange(handler: OfflineChangeHandler): () => void {
  ensureListeners();
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

export const OFFLINE_BASE_HINT = BASE_HINT;
