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
  invoice_number: string;
  patient_name: string;
  status: string;
  total: string;
  paid_amount: string;
  balance_due: string;
  change: 'created' | 'updated' | 'voided' | 'reversed';
  at: string | null;
  actor_id?: number | null;
}

export interface PaymentChangedEvent {
  id: number;
  invoice_id: number;
  cash_session_id: number;
  method: string;
  amount: string;
  status: string;
  change: 'registered' | 'voided';
  at: string | null;
  actor_id?: number | null;
}

export interface CashSessionChangedEvent {
  id: number;
  user_id: number;
  status: string;
  opened_at: string | null;
  closed_at: string | null;
  change: 'opened' | 'closed';
  actor_id?: number | null;
}
