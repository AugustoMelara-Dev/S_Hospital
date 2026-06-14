/**
 * Public shape of GET /api/system/echo-config. Mirrors
 * backend/app/Http/Controllers/EchoConfigController.php.
 */
export interface EchoConfig {
  driver: 'pusher' | 'log' | 'null';
  enabled: boolean;
  key: string;
  cluster: string;
  host: string;
  port: number;
  scheme: 'http' | 'https';
  useTLS: boolean;
  authEndpoint: string;
  channels: {
    invoices: 'invoices';
    cash: 'cash';
    payments: 'payments';
    settings: 'settings';
    backups: 'backups';
  };
}

export interface InvoiceChangedEvent {
  id: number;
  status: string;
  change: 'created' | 'updated' | 'voided' | 'reversed';
  at: string | null;
}

export interface PaymentChangedEvent {
  id: number;
  invoice_id: number;
  status: string;
  change: 'registered' | 'voided';
  at: string | null;
}

export interface CashSessionChangedEvent {
  id: number;
  status: string;
  change: 'opened' | 'closed';
}
