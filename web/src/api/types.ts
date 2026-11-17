/**
 * API types (SPEC §4 and §6). Money fields are integer cents (`*_cents`),
 * quantities are hundredths, rates are basis points. Datetimes are ISO-8601
 * strings with offset; dates are `YYYY-MM-DD`.
 */

export type ISODateTime = string;
export type ISODate = string;
export type ID = number;

export type Paginated<T> = {
  items: T[];
  page: number;
  per_page: number;
  total: number;
};

export type ApiErrorBody = {
  error: { code: string; message: string; fields?: Record<string, string> };
};

// ---------- Permissions & auth ----------

export const PERMISSIONS = [
  'settings.view',
  'settings.update',
  'catalog.view',
  'catalog.manage',
  'invoices.view',
  'invoices.create',
  'invoices.operate_any',
  'invoices.void',
  'invoices.reverse',
  'cash.view',
  'cash.open',
  'cash.close',
  'cash.close_any',
  'payments.create',
  'payments.view',
  'payments.void',
  'receipts.view',
  'receipts.reprint',
  'receipts.reprint_any',
  'receipt_settings.view',
  'receipt_settings.update',
  'reports.own',
  'reports.all',
  'reports.export',
  'users.view',
  'users.manage',
  'backups.view',
  'backups.create',
  'backups.download',
  'audit.view',
  'system.status',
  'patients.mark_dialysis_prescription',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type RoleCode = 'admin' | 'supervisor' | 'auditor' | 'soporte' | 'cajero' | (string & {});

export type Me = {
  id: ID;
  name: string;
  username: string;
  email: string | null;
  role: { code: RoleCode; name: string };
  permissions: Permission[];
  must_change_password: boolean;
};

export type LoginRequest = { login: string; password: string };
export type ChangePasswordRequest = { current_password: string; new_password: string };

export type Health = { status: 'ok'; version: string };
export type Branding = { hospital_name: string; slogan: string | null; has_logo: boolean };

// ---------- Settings & fiscal ----------

export type Settings = {
  hospital_name: string;
  rtn: string | null;
  address: string | null;
  phone: string | null;
  slogan: string | null;
  government_line: string | null;
  secretariat_line: string | null;
  receipt_location: string | null;
  receipt_footer_text: string | null;
  default_tax_rate_bp: number;
  partial_payments_enabled: boolean;
  has_logo: boolean;
  logo_mime?: string | null;
  updated_at?: ISODateTime;
};

export type FiscalSequence = {
  id: ID;
  prefix: string;
  cai: string;
  min_number: number;
  max_number: number;
  current_number: number;
  valid_until: ISODate;
  active: boolean;
  created_at: ISODateTime;
  updated_at: ISODateTime;
};

export type TaxRate = {
  id: ID;
  name: string;
  rate_bp: number;
  active: boolean;
  is_default: boolean;
  in_use?: boolean;
};

// ---------- Catalog ----------

export type Category = {
  id: ID;
  name: string;
  slug: string;
  active: boolean;
  sort_order: number;
  services_count?: number;
};

export type Area = {
  id: ID;
  name: string;
  slug: string;
  active: boolean;
  sort_order: number;
};

export const ERYTHROPOIETIN_RULE = 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION' as const;

export type Service = {
  id: ID;
  category_id: ID;
  category?: Pick<Category, 'id' | 'name' | 'active'>;
  area_id: ID | null;
  area?: Pick<Area, 'id' | 'name'> | null;
  name: string;
  slug: string;
  source_key: string | null;
  aliases: string | null;
  description: string | null;
  price_cents: number;
  tax_rate_id: ID | null;
  tax_rate?: Pick<TaxRate, 'id' | 'name' | 'rate_bp'> | null;
  active: boolean;
  visible_in_billing: boolean;
  is_billable: boolean;
  special_rule_code: string | null;
  created_at?: ISODateTime;
  updated_at?: ISODateTime;
};

export type ServicePriceHistory = {
  id: ID;
  service_id: ID;
  old_price_cents: number;
  new_price_cents: number;
  reason: string;
  changed_by: ID;
  changed_by_name?: string;
  changed_at: ISODateTime;
};

export type ServiceImportPreview = {
  rows: Array<{
    line: number;
    action: 'create' | 'update' | 'skip' | 'error';
    name: string;
    category: string;
    price_cents: number | null;
    errors?: string[];
  }>;
  summary: { create: number; update: number; skip: number; error: number };
};

// ---------- Cash ----------

export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'other';

export type MethodTotals = Record<PaymentMethod, number>;

export type CashRegister = { id: ID; code: string; name: string; active: boolean };

export type ReconciliationBlocker = { code: string; message: string; count: number };

export type Reconciliation = {
  opening_cents: number;
  expected_cash_cents: number;
  method_totals: MethodTotals;
  payments_count: number;
  payments_total_cents: number;
  pending_count: number;
  pending_cents: number;
  missing_receipts_count: number;
  can_close: boolean;
  blockers: ReconciliationBlocker[];
};

export type CashMovementType = 'opening' | 'payment' | 'payment_void' | 'closing';

export type CashMovement = {
  id: ID;
  cash_session_id: ID;
  payment_id: ID | null;
  user_id: ID;
  type: CashMovementType;
  method: PaymentMethod | null;
  amount_cents: number;
  notes: string | null;
  occurred_at: ISODateTime;
  invoice_number?: string | null;
};

export type CashBreakdown = {
  bills: Partial<Record<'500' | '200' | '100' | '50' | '20' | '10' | '5' | '2' | '1', number>>;
  coins_cents: number;
};

export type CashSessionStatus = 'open' | 'closed';

export type CashSession = {
  id: ID;
  cash_register_id: ID;
  cash_register?: Pick<CashRegister, 'id' | 'code' | 'name'>;
  user_id: ID;
  user?: { id: ID; name: string };
  status: CashSessionStatus;
  opening_cents: number;
  opening_notes: string | null;
  opened_at: ISODateTime;
  closed_at: ISODateTime | null;
  closed_by: ID | null;
  counted_cents: number | null;
  expected_cash_cents: number | null;
  difference_cents: number | null;
  closing_notes: string | null;
  closing_breakdown: CashBreakdown | null;
  method_totals: MethodTotals | null;
  payments_count: number | null;
  payments_total_cents: number | null;
  reconciliation?: Reconciliation;
  movements?: CashMovement[];
};

export type OpenCashSessionRequest = { cash_register_id?: ID; opening_cents: number; notes?: string };
export type CloseCashSessionRequest = { counted_cents: number; notes?: string; breakdown?: CashBreakdown };

// ---------- Invoices ----------

export type InvoiceStatus = 'issued' | 'partial' | 'paid' | 'void';
export type InvoiceSettlement = 'pending' | 'paid' | 'free_by_rule' | 'zero_price';

export type TaxBreakdownEntry = { rate_bp: number; base_cents: number; tax_cents?: number; label: string };

export type InvoiceItem = {
  id: ID;
  invoice_id: ID;
  service_id: ID | null;
  service_name: string;
  category_name: string;
  area_name: string | null;
  quantity_hundredths: number;
  unit_price_registered_cents: number;
  unit_price_cents: number;
  rule_adjustment_cents: number;
  rate_bp: number;
  line_subtotal_cents: number;
  tax_cents: number;
  line_total_cents: number;
  special_rule_applied: boolean;
  position: number;
};

export type PaymentStatus = 'posted' | 'void';

export type Payment = {
  id: ID;
  invoice_id: ID;
  cash_session_id: ID;
  user_id: ID;
  user_name?: string;
  method: PaymentMethod;
  amount_cents: number;
  received_cents: number | null;
  change_cents: number | null;
  reference: string | null;
  status: PaymentStatus;
  void_reason: string | null;
  voided_by: ID | null;
  voided_at: ISODateTime | null;
  paid_at: ISODateTime;
};

export type ReceiptStatus = 'issued' | 'void';

export type Receipt = {
  id: ID;
  invoice_id: ID;
  series_id: ID;
  number: number;
  number_full: string;
  status: ReceiptStatus;
  amount_cents: number;
  amount_words: string;
  payer_name: string;
  cash_session_id: ID | null;
  issued_by: ID;
  issued_at: ISODateTime;
  reprint_count: number;
  voided_at: ISODateTime | null;
  void_reason: string | null;
  snapshot?: Record<string, unknown>;
};

export type Invoice = {
  id: ID;
  number: string;
  fiscal_sequence_id: ID;
  fiscal_cai: string;
  fiscal_range_from: string;
  fiscal_range_to: string;
  fiscal_valid_until: ISODate;
  hospital_name: string;
  hospital_rtn: string | null;
  hospital_address: string | null;
  hospital_phone: string | null;
  government_line: string | null;
  secretariat_line: string | null;
  receipt_location: string | null;
  receipt_footer_text: string | null;
  patient_name: string;
  subtotal_cents: number;
  exempt_cents: number;
  taxable_cents: number;
  tax_cents: number;
  total_cents: number;
  paid_cents: number;
  balance_cents: number;
  tax_breakdown: TaxBreakdownEntry[];
  status: InvoiceStatus;
  settlement: InvoiceSettlement;
  dialysis_prescription: boolean;
  cash_session_id: ID;
  issued_by: ID;
  issued_by_name?: string;
  issued_at: ISODateTime;
  voided_by: ID | null;
  voided_at: ISODateTime | null;
  void_reason: string | null;
  reversed: boolean;
  items?: InvoiceItem[];
  payments?: Payment[];
  receipt?: Receipt | null;
  /** Server hints for the current user (optional). */
  can_operate?: boolean;
};

export type InvoiceItemInput = { service_id: ID; quantity_hundredths: number };

export type InvoicePreviewRequest = { items: InvoiceItemInput[]; dialysis_prescription: boolean };
export type CreateInvoiceRequest = InvoicePreviewRequest & { patient_name: string };

export type InvoicePreviewLine = Omit<InvoiceItem, 'id' | 'invoice_id'>;

export type InvoicePreview = {
  items: InvoicePreviewLine[];
  subtotal_cents: number;
  exempt_cents: number;
  taxable_cents: number;
  tax_cents: number;
  total_cents: number;
  tax_breakdown: TaxBreakdownEntry[];
  settlement: InvoiceSettlement;
};

export type CreatePaymentRequest = {
  method: PaymentMethod;
  amount_cents: number;
  received_cents?: number;
  reference?: string;
};

export type CreatePaymentResponse = { invoice: Invoice; payment: Payment; receipt: Receipt | null };

export type ReasonRequest = { reason: string };

// ---------- Receipt settings ----------

export type PaperSize =
  | 'half_letter'
  | 'letter_portrait'
  | 'letter_landscape'
  | 'a5_landscape'
  | 'a4_portrait'
  | 'thermal_80'
  | 'thermal_58';

export type CopiesMode = 'original_only' | 'original_first' | 'original_first_second';

export type PrintProfile = {
  id: ID;
  code: string;
  name: string;
  paper: PaperSize;
  width_mm: number;
  height_mm: number;
  margins_mm: number;
  copies_mode: CopiesMode;
  show_seal_space: boolean;
  use_logo: boolean;
  active: boolean;
  is_default: boolean;
};

export type ReceiptSeries = {
  id: ID;
  series: string;
  prefix: string;
  min_number: number;
  max_number: number;
  current_number: number;
  range_authorization: string | null;
  legal_text: string | null;
  number_color: string;
  active: boolean;
};

export type ReceiptSettings = { series: ReceiptSeries[]; profiles: PrintProfile[] };

// ---------- Reports ----------

export type MethodAmount = { method: PaymentMethod; count: number; amount_cents: number };

export type ReportToday = {
  date: ISODate;
  billed_cents: number;
  collected_cents: number;
  pending_cents: number;
  without_charge_count: number;
  voided_count: number;
  by_method: MethodAmount[];
  current_session: CashSession | null;
  recent?: Array<Pick<Invoice, 'id' | 'number' | 'issued_at' | 'patient_name' | 'status' | 'settlement' | 'total_cents'>>;
  attention?: { pending_count: number; pending_cents: number; missing_receipts_count: number };
};

export type ReportSummaryTotals = {
  billed_cents: number;
  collected_cents: number;
  pending_cents: number;
  without_charge_count: number;
  invoices_count: number;
  paid_count: number;
  partial_count: number;
  average_ticket_cents: number;
  voided_cents: number;
  reversed_cents: number;
  free_lines_count: number;
  free_value_cents: number;
};

export type ReportSummary = {
  summary: ReportSummaryTotals;
  by_method: MethodAmount[];
  daily: Array<{ date: ISODate; billed_cents: number; collected_cents: number }>;
  operations: Invoice[];
  lines: Array<InvoiceItem & { invoice_number: string; issued_at: ISODateTime; patient_name: string }>;
  payments: Array<Payment & { invoice_number: string; patient_name: string }>;
  sessions: CashSession[];
  gratuities: Array<InvoiceItem & { invoice_number: string; issued_at: ISODateTime; patient_name: string }>;
  top_services: Array<{ service_name: string; quantity_hundredths: number; total_cents: number }>;
};

export type ReportFilters = {
  date_from: ISODate;
  date_to: ISODate;
  method?: PaymentMethod;
  status?: InvoiceStatus;
  user_id?: ID;
  cash_session_id?: ID;
  category_id?: ID;
};

// ---------- Users & roles ----------

export type User = {
  id: ID;
  name: string;
  username: string;
  email: string | null;
  role_id: ID;
  role: { id: ID; code: RoleCode; name: string };
  active: boolean;
  must_change_password: boolean;
  last_login_at: ISODateTime | null;
  created_at: ISODateTime;
};

export type Role = {
  id: ID;
  code: RoleCode;
  name: string;
  is_system: boolean;
  permissions: Permission[];
  users_count?: number;
};

export type PermissionCatalog = Array<{
  module: string;
  label: string;
  permissions: Array<{ code: Permission; label: string }>;
}>;

export type RolesResponse = { items: Role[]; permission_catalog: PermissionCatalog };

// ---------- System ----------

export type AuditResult = 'success' | 'failed' | 'denied';

export type AuditLog = {
  id: ID;
  user_id: ID | null;
  user_name?: string | null;
  action: string;
  entity_type: string | null;
  entity_id: ID | null;
  result: AuditResult;
  reason: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip: string | null;
  created_at: ISODateTime;
};

export type BackupStatus = 'pending' | 'success' | 'failed';

export type Backup = {
  id: ID;
  filename: string;
  size_bytes: number | null;
  sha256: string | null;
  status: BackupStatus;
  kind: 'manual' | 'scheduled';
  error: string | null;
  created_by: ID | null;
  created_by_name?: string | null;
  created_at: ISODateTime;
  completed_at: ISODateTime | null;
};

export type SystemStatus = {
  version: string;
  database: { ok: boolean; engine?: string; version?: string };
  migration: { current: string | null; head: string | null; up_to_date: boolean };
  disk: { free_bytes: number; total_bytes: number };
  last_backup: Backup | null;
};

// ---------- UI label maps (Spanish, per TERMINOLOGIA) ----------

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  other: 'Otro',
};

/** Display status combines `status` and `settlement`. */
export type InvoiceDisplayStatus = 'pending' | 'partial' | 'paid' | 'no_charge' | 'void';

export function invoiceDisplayStatus(inv: Pick<Invoice, 'status' | 'settlement'>): InvoiceDisplayStatus {
  if (inv.status === 'void') return 'void';
  if (inv.status === 'partial') return 'partial';
  if (inv.status === 'issued') return 'pending';
  if (inv.settlement === 'free_by_rule' || inv.settlement === 'zero_price') return 'no_charge';
  return 'paid';
}

export const INVOICE_STATUS_LABEL: Record<InvoiceDisplayStatus, string> = {
  pending: 'Pendiente de cobro',
  partial: 'Pago parcial',
  paid: 'Pagada',
  no_charge: 'Emitida sin cobro',
  void: 'Anulada',
};

export const AUDIT_RESULT_LABEL: Record<AuditResult, string> = {
  success: 'Correcto',
  failed: 'Fallido',
  denied: 'Denegado',
};
