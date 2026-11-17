/**
 * API types — single source of truth for the web client.
 *
 * Mirrors the real backend (`api/app/schemas/*.py` and the plain dicts built in
 * `api/app/services/reports.py`, `api/app/routers/system.py`). Money fields are
 * integer cents (`*_cents`), quantities are hundredths, rates are basis points.
 * Datetimes are ISO-8601 strings with offset; dates are `YYYY-MM-DD`.
 */

export type ISODateTime = string;
export type ISODate = string;
export type ID = number;

/** List envelope `{items,page,per_page,total}` (also used by full lookups). */
export type Paginated<T> = {
  items: T[];
  page: number;
  per_page: number;
  total: number;
};

export type ApiErrorBody = {
  error: { code: string; message: string; fields?: Record<string, string> };
};

/** `{id, name}` reference used across responses. */
export type UserRef = { id: ID; name: string };

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

/** GET /auth/me, POST /auth/login. */
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
export type Branding = { hospital_name: string; slogan: string; has_logo: boolean };

// ---------- Settings & fiscal ----------

/** GET/PUT /settings (`SettingsOut`). Text fields are never null (empty string). */
export type Settings = {
  hospital_name: string;
  rtn: string;
  address: string;
  phone: string;
  slogan: string;
  government_line: string;
  secretariat_line: string;
  receipt_location: string;
  receipt_footer_text: string;
  default_tax_rate_bp: number;
  partial_payments_enabled: boolean;
  has_logo: boolean;
  logo_mime: string | null;
  updated_at: ISODateTime;
};

/** GET /fiscal-sequences items (`FiscalSequenceOut`). */
export type FiscalSequence = {
  id: ID;
  prefix: string;
  cai: string;
  min_number: number;
  max_number: number;
  current_number: number;
  next_number: number | null;
  next_number_formatted: string | null;
  remaining: number;
  valid_until: ISODate;
  active: boolean;
  expired: boolean;
  exhausted: boolean;
  low_range: boolean;
  created_at: ISODateTime;
  updated_at: ISODateTime;
};

/** GET /tax-rates items (`TaxRateOut`). */
export type TaxRate = {
  id: ID;
  name: string;
  rate_bp: number;
  active: boolean;
  is_default: boolean;
  services_count: number;
};

// ---------- Catalog ----------

/** GET /categories and /areas items (`GroupOut`). */
export type Category = {
  id: ID;
  name: string;
  slug: string;
  active: boolean;
  sort_order: number;
  services_count: number;
};

export type Area = Category;

export const ERYTHROPOIETIN_RULE = 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION' as const;

/** GET /services items (`ServiceOut`). */
export type Service = {
  id: ID;
  name: string;
  category: { id: ID; name: string };
  area: { id: ID; name: string } | null;
  price_cents: number;
  tax_rate: { id: ID; name: string; rate_bp: number } | null;
  active: boolean;
  visible_in_billing: boolean;
  is_billable: boolean;
  special_rule_code: string | null;
  aliases: string;
  description: string;
  updated_at: ISODateTime;
};

/** GET /services/{id}/history items (`PriceHistoryOut`). */
export type ServicePriceHistory = {
  id: ID;
  old_price_cents: number;
  new_price_cents: number;
  reason: string;
  changed_by: UserRef | null;
  changed_at: ISODateTime;
};

/** POST /services/import (`ImportReport`). */
export type ImportLine = {
  line: number;
  category: string;
  name: string;
  action: 'create' | 'update' | 'unchanged' | 'error' | (string & {});
  service_id?: ID | null;
  new_category: boolean;
  changes: Record<string, Record<string, unknown>>;
  errors: string[];
};

export type ImportReport = {
  mode: 'preview' | 'apply' | (string & {});
  applied: boolean;
  summary: {
    total: number;
    create: number;
    update: number;
    unchanged: number;
    error: number;
    new_categories: string[];
  };
  lines: ImportLine[];
};

// ---------- Cash ----------

export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'other';

export type MethodTotals = Record<PaymentMethod, number>;

/** GET /cash-registers returns a plain array of these. */
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

/** `MovementOut`. */
export type CashMovement = {
  id: ID;
  type: CashMovementType;
  method: PaymentMethod | null;
  amount_cents: number;
  notes: string;
  occurred_at: ISODateTime;
  payment_id: ID | null;
  invoice_id: ID | null;
  invoice_number: string | null;
  reference: string;
  user_id: ID;
};

export type CashBreakdown = {
  bills: Partial<Record<'500' | '200' | '100' | '50' | '20' | '10' | '5' | '2' | '1', number>>;
  coins_cents: number;
};

export type CashSessionStatus = 'open' | 'closed';

/** `CashSessionOut` (GET /cash-sessions/current|{id}, list items, open/close). */
export type CashSession = {
  id: ID;
  status: CashSessionStatus;
  cash_register: { id: ID; code: string; name: string };
  user: UserRef;
  opening_cents: number;
  opening_notes: string;
  opened_at: ISODateTime;
  closed_at: ISODateTime | null;
  closed_by: UserRef | null;
  counted_cents: number | null;
  expected_cash_cents: number | null;
  difference_cents: number | null;
  closing_notes: string;
  closing_breakdown: CashBreakdown | null;
  method_totals: MethodTotals | null;
  payments_count: number;
  payments_total_cents: number;
  /** Present on current/detail/open/close. */
  reconciliation?: Reconciliation | null;
  /** Present on detail/close. */
  movements?: CashMovement[] | null;
};

export type OpenCashSessionRequest = { cash_register_id?: ID; opening_cents: number; notes?: string };
export type CloseCashSessionRequest = { counted_cents: number; notes?: string; breakdown?: CashBreakdown };

// ---------- Invoices ----------

export type InvoiceStatus = 'issued' | 'partial' | 'paid' | 'void';
export type InvoiceSettlement = 'pending' | 'paid' | 'free_by_rule' | 'zero_price';

export type TaxBreakdownEntry = { rate_bp: number; base_cents: number; tax_cents: number; label: string };

/** `InvoiceItemOut`. */
export type InvoiceItem = {
  id: ID;
  position: number;
  service_id: ID | null;
  service_name: string;
  category_name: string;
  area_name: string;
  quantity_hundredths: number;
  unit_price_registered_cents: number;
  unit_price_cents: number;
  rule_adjustment_cents: number;
  rate_bp: number;
  line_subtotal_cents: number;
  tax_cents: number;
  line_total_cents: number;
  special_rule_applied: boolean;
};

export type PaymentStatus = 'posted' | 'void';

/** `PaymentOut`. */
export type Payment = {
  id: ID;
  invoice_id: ID;
  cash_session_id: ID;
  user: UserRef;
  method: PaymentMethod;
  amount_cents: number;
  received_cents: number | null;
  change_cents: number | null;
  reference: string;
  status: PaymentStatus;
  paid_at: ISODateTime;
  void_reason: string | null;
  voided_at: ISODateTime | null;
};

export type ReceiptStatus = 'issued' | 'void';

/** `ReceiptSummaryOut` (embedded in invoices and payment results). */
export type ReceiptSummary = {
  id: ID;
  number_full: string;
  status: ReceiptStatus;
  reprint_count: number;
};

export type PrintEvent = {
  type: string;
  reason: string;
  profile_code: string | null;
  user_name: string | null;
  created_at: ISODateTime;
};

/** GET /receipts/{id} (`ReceiptOut`). */
export type Receipt = ReceiptSummary & {
  invoice_id: ID;
  invoice_number: string | null;
  amount_cents: number;
  amount_words: string;
  payer_name: string;
  cash_session_id: ID | null;
  issued_by: ID;
  issued_by_name: string | null;
  issued_at: ISODateTime;
  printed: boolean;
  voided_at: ISODateTime | null;
  void_reason: string | null;
  events: PrintEvent[];
};

/** Server-computed permissions of the current user on one invoice. */
export type InvoiceActions = {
  can_pay: boolean;
  can_void: boolean;
  can_reverse: boolean;
  can_reprint: boolean;
  can_issue_receipt: boolean;
};

/** GET /invoices list rows (`InvoiceSummaryOut`). */
export type InvoiceSummary = {
  id: ID;
  number: string;
  patient_name: string;
  status: InvoiceStatus;
  settlement: InvoiceSettlement;
  total_cents: number;
  paid_cents: number;
  balance_cents: number;
  dialysis_prescription: boolean;
  reversed: boolean;
  issued_at: ISODateTime;
  issued_by: UserRef;
  cash_session_id: ID;
};

/** GET /invoices/{id}, POST /invoices, void/reverse/receipt (`InvoiceOut`). */
export type Invoice = InvoiceSummary & {
  subtotal_cents: number;
  exempt_cents: number;
  taxable_cents: number;
  tax_cents: number;
  rule_adjustment_cents: number;
  tax_breakdown: TaxBreakdownEntry[];
  fiscal: { cai: string; range_from: string; range_to: string; valid_until: ISODate | null };
  voided_at: ISODateTime | null;
  voided_by: UserRef | null;
  void_reason: string | null;
  items: InvoiceItem[];
  payments: Payment[];
  receipt: ReceiptSummary | null;
  receipt_error?: string | null;
  actions: InvoiceActions;
};

export type InvoiceItemInput = { service_id: ID; quantity_hundredths: number };

export type InvoicePreviewRequest = { items: InvoiceItemInput[]; dialysis_prescription: boolean };
export type CreateInvoiceRequest = InvoicePreviewRequest & { patient_name: string };

/** `PreviewLineOut`. */
export type InvoicePreviewLine = {
  position: number;
  service_id: ID;
  service_name: string;
  category_name: string;
  quantity_hundredths: number;
  unit_price_registered_cents: number;
  unit_price_cents: number;
  rule_adjustment_cents: number;
  rate_bp: number;
  line_subtotal_cents: number;
  tax_cents: number;
  line_total_cents: number;
  special_rule_applied: boolean;
  rule_eligible: boolean;
};

/** POST /invoices/preview (`InvoicePreviewOut`). */
export type InvoicePreview = {
  items: InvoicePreviewLine[];
  subtotal_cents: number;
  exempt_cents: number;
  taxable_cents: number;
  tax_cents: number;
  total_cents: number;
  rule_adjustment_cents: number;
  tax_breakdown: TaxBreakdownEntry[];
  dialysis_prescription: boolean;
  has_rule_eligible_items: boolean;
};

export type CreatePaymentRequest = {
  method: PaymentMethod;
  amount_cents: number;
  received_cents?: number;
  reference?: string;
};

/** POST /invoices/{id}/payments (`PaymentResultOut`). */
export type CreatePaymentResponse = {
  invoice: Invoice;
  payment: Payment;
  receipt: ReceiptSummary | null;
  receipt_error: string | null;
};

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

/** `PrintProfileOut`. */
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
  allowed_for_institutional: boolean;
};

/** `ReceiptSeriesOut`. */
export type ReceiptSeries = {
  id: ID;
  series: string;
  prefix: string;
  min_number: number;
  max_number: number;
  current_number: number;
  range_authorization: string;
  legal_text: string;
  number_color: string;
  active: boolean;
};

export type ReceiptSettings = { series: ReceiptSeries[]; profiles: PrintProfile[] };

// ---------- Reports (plain dicts from app/services/reports.py) ----------

export type MethodAmount = { method: PaymentMethod; label: string; count: number; amount_cents: number };

/** Operation row (`_operation_row`). */
export type ReportOperation = {
  id: ID;
  number: string;
  issued_at: ISODateTime;
  patient_name: string;
  status: InvoiceStatus;
  status_label: string;
  settlement: InvoiceSettlement;
  reversed: boolean;
  total_cents: number;
  paid_cents: number;
  balance_cents: number;
  cashier_name: string;
  cash_session_id: ID;
  receipt_number: string | null;
};

/** Cash session row (`_session_row`). */
export type ReportSession = {
  id: ID;
  register_name: string;
  user_id: ID;
  user_name: string;
  status: CashSessionStatus;
  opened_at: ISODateTime;
  closed_at: ISODateTime | null;
  opening_cents: number;
  expected_cash_cents: number;
  counted_cents: number | null;
  difference_cents: number | null;
  payments_count: number;
  payments_total_cents: number;
  method_totals: MethodTotals;
};

/** GET /reports/today. */
export type ReportToday = {
  date: ISODate;
  scope: 'all' | 'own';
  billed_cents: number;
  collected_cents: number;
  pending_cents: number;
  without_charge_count: number;
  voided_count: number;
  invoices_count: number;
  payments_count: number;
  by_method: MethodAmount[];
  current_session: ReportSession | null;
  recent_operations: ReportOperation[];
  attention: { pending_count: number; pending_cents: number; missing_receipts_count: number };
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
  voided_count: number;
  voided_cents: number;
  reversed_cents: number;
  free_lines_count: number;
  free_value_cents: number;
  payments_count: number;
};

export type ReportLine = {
  invoice_id: ID;
  invoice_number: string;
  issued_at: ISODateTime;
  patient_name: string;
  service_name: string;
  category_name: string;
  area_name: string;
  quantity_hundredths: number;
  unit_price_registered_cents: number;
  unit_price_cents: number;
  rule_adjustment_cents: number;
  rate_bp: number;
  line_subtotal_cents: number;
  tax_cents: number;
  line_total_cents: number;
  special_rule_applied: boolean;
};

export type ReportPayment = {
  id: ID;
  invoice_id: ID;
  invoice_number: string;
  patient_name: string;
  paid_at: ISODateTime;
  method: PaymentMethod;
  method_label: string;
  reference: string;
  amount_cents: number;
  received_cents: number | null;
  change_cents: number | null;
  status: PaymentStatus;
  cashier_name: string;
  cash_session_id: ID;
};

export type ReportGratuity = {
  invoice_id: ID;
  invoice_number: string;
  issued_at: ISODateTime;
  patient_name: string;
  service_name: string;
  quantity_hundredths: number;
  unit_price_registered_cents: number;
  value_cents: number;
  cashier_name: string;
};

export type ReportTopService = {
  service_name: string;
  category_name: string;
  quantity_hundredths: number;
  lines_count: number;
  amount_cents: number;
};

/** GET /reports/summary. */
export type ReportSummary = {
  filters: ReportFilters & { date_from: ISODate; date_to: ISODate };
  summary: ReportSummaryTotals;
  by_method: MethodAmount[];
  daily: Array<{ date: ISODate; billed_cents: number; collected_cents: number; invoices_count: number }>;
  operations: ReportOperation[];
  lines: ReportLine[];
  payments: ReportPayment[];
  sessions: ReportSession[];
  gratuities: ReportGratuity[];
  top_services: ReportTopService[];
};

/** Report `status` filter: invoice statuses plus `without_charge` (free_by_rule/zero_price). */
export type ReportStatusFilter = InvoiceStatus | 'without_charge';

export type ReportFilters = {
  date_from: ISODate;
  date_to: ISODate;
  method?: PaymentMethod | null;
  status?: ReportStatusFilter | null;
  user_id?: ID | null;
  cash_session_id?: ID | null;
  category_id?: ID | null;
};

// ---------- Users & roles ----------

/** `UserOut`. */
export type User = {
  id: ID;
  name: string;
  username: string;
  email: string | null;
  role: { id: ID; code: RoleCode; name: string };
  active: boolean;
  must_change_password: boolean;
  last_login_at: ISODateTime | null;
};

/** `RoleOut`. */
export type Role = {
  id: ID;
  code: RoleCode;
  name: string;
  is_system: boolean;
  editable: boolean;
  permissions: Permission[];
  users_count: number;
};

export type PermissionCatalog = Array<{
  module: string;
  label: string;
  permissions: Array<{ code: Permission; label: string }>;
}>;

/** GET /roles (`RolesOut`). */
export type RolesResponse = Paginated<Role> & { permission_catalog: PermissionCatalog };

// ---------- System ----------

export type AuditResult = 'success' | 'failed' | 'denied';

/** `AuditLogOut`. */
export type AuditLog = {
  id: ID;
  created_at: ISODateTime;
  user_id: ID | null;
  user_name: string | null;
  username: string | null;
  action: string;
  entity_type: string | null;
  entity_id: ID | null;
  result: AuditResult;
  reason: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip: string | null;
};

export type BackupStatus = 'pending' | 'success' | 'failed';

/** `BackupOut`. */
export type Backup = {
  id: ID;
  filename: string;
  size_bytes: number | null;
  sha256: string | null;
  status: BackupStatus;
  kind: 'manual' | 'scheduled';
  error: string | null;
  created_by: ID | null;
  created_by_name: string | null;
  created_at: ISODateTime;
  completed_at: ISODateTime | null;
};

/** GET /backups (`BackupPage`). */
export type BackupPage = Paginated<Backup> & { last_success: Backup | null };

/** GET /system/status. */
export type SystemStatus = {
  version: string;
  server_time: ISODateTime;
  timezone: string;
  database: {
    dialect: string;
    server_version: string | null;
    migration: string | null;
    migration_head: string | null;
    up_to_date: boolean | null;
  };
  disk: { path: string; total_bytes: number; free_bytes: number; used_bytes: number } | null;
  backups: {
    last_success: Backup | null;
    dump_tool_available: boolean;
    dedicated_key: boolean;
    daily_time: string;
  };
  counts: {
    users_active: number;
    services_active: number;
    invoices: number;
    receipts: number;
    open_cash_sessions: number;
    backups: number;
  };
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

export function invoiceDisplayStatus(inv: Pick<InvoiceSummary, 'status' | 'settlement'>): InvoiceDisplayStatus {
  if (inv.status === 'void') return 'void';
  if (inv.status === 'partial') return 'partial';
  if (inv.status === 'issued') return 'pending';
  if (inv.settlement === 'free_by_rule' || inv.settlement === 'zero_price') return 'no_charge';
  return 'paid';
}

/** UI display status → `status` query param of GET /invoices and /reports/*. */
export const DISPLAY_STATUS_TO_API: Record<InvoiceDisplayStatus, ReportStatusFilter> = {
  pending: 'issued',
  partial: 'partial',
  paid: 'paid',
  no_charge: 'without_charge',
  void: 'void',
};

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
