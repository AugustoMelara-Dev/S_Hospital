export type AuthUser = {
  id: number;
  name: string;
  email: string;
  username: string;
  active: boolean;
  roles: string[];
  permissions: string[];
  direct_permissions?: string[];
  uses_exact_permission_map?: boolean;
  service_area_id?: number | null;
  must_change_password: boolean;
};

export type RolePermission = {
  name: string;
  module: string;
  label: string;
};

export type RoleDefinition = {
  id: number;
  name: string;
  protected: boolean;
  permissions: RolePermission[];
};

export type PermissionCatalogGroup = {
  module: string;
  label: string;
  permissions: RolePermission[];
};

export type FiscalSettings = {
  id?: number;
  hospital_name: string;
  rtn: string;
  default_tax_rate: string;
  receipt_paper_size?: InstitutionalReceiptPaperSize;
  primary_color: 'teal' | 'blue' | 'indigo' | 'green' | 'rose';
  address?: string;
  slogan?: string;
  scanner_enabled?: boolean;
  partial_payments_enabled?: boolean;
  receipt_template_mode?: 'institutional';
  government_line?: string | null;
  secretariat_line?: string | null;
  receipt_location?: string | null;
  receipt_footer_text?: string | null;
};

export type PublicBranding = Pick<
  FiscalSettings,
  'hospital_name' | 'primary_color' | 'slogan' | 'government_line' | 'secretariat_line' | 'receipt_location'
>;

export type OperationalSettings = Pick<
  FiscalSettings,
  'default_tax_rate' | 'scanner_enabled' | 'partial_payments_enabled' | 'receipt_paper_size'
>;

export type FiscalSequence = {
  id?: number;
  document_type: 'invoice';
  prefix: string;
  min_number: number;
  max_number: number;
  current_number: number;
  cai: string;
  valid_until: string;
  active: boolean;
};

export type Category = {
  id: number;
  name: string;
  slug: string;
  active: boolean;
  sort_order: number;
};

export type Area = {
  id: number;
  name: string;
  slug: string;
  active: boolean;
};

export type ServiceArea = Area;

export type Service = {
  id: number;
  category_id: number;
  area_id?: number | null;
  name: string;
  aliases?: string | null;
  slug: string;
  scan_code?: string | null;
  barcode?: string | null;
  qr_code?: string | null;
  description?: string | null;
  internal_code?: string | null;
  price: string;
  taxable: boolean;
  active: boolean;
  visible_in_billing?: boolean;
  is_billable?: boolean;
  special_rule_code: string | null;
  category?: Category;
  area?: Area | null;
};

export type CategoryPayload = {
  name: string;
  active: boolean;
  sort_order: number;
};

export type ServicePayload = {
  category_id: number;
  area_id?: number | null;
  name: string;
  aliases?: string | null;
  price: string;
  price_change_reason?: string | null;
  tax_change_reason?: string | null;
  scan_code: string | null;
  barcode: string | null;
  qr_code: string | null;
  description?: string | null;
  internal_code?: string | null;
  taxable: boolean;
  active: boolean;
  visible_in_billing?: boolean;
  is_billable?: boolean;
  special_rule_code: string | null;
  print_on_receipt?: boolean;
};

export type InvoiceItemPayload = {
  service_id: number;
  quantity: string;
  dialysis_prescription?: boolean;
  notes?: string | null;
};

export type InvoicePayload = {
  patient_name: string;
  dialysis_prescription?: boolean;
  items: InvoiceItemPayload[];
};

export type InvoiceItem = {
  id: number;
  service_id: number;
  service_name: string;
  category_id: number;
  category_name: string;
  area_id?: number | null;
  area_name?: string | null;
  quantity: string;
  unit_price: string;
  tax_rate: string;
  tax_amount: string;
  line_subtotal: string;
  line_total: string;
  special_rule_code: string | null;
  special_rule_applied: boolean;
  notes: string | null;
};

export type Invoice = {
  id: number;
  invoice_number: string;
  patient_name: string;
  subtotal: string;
  tax_amount: string;
  discount_amount: string;
  total: string;
  paid_amount: string;
  balance_due: string;
  status: 'issued' | 'partial' | 'paid' | 'void';
  issued_at: string;
  void_reason?: string | null;
  voided_at?: string | null;
  items: InvoiceItem[];
  payments?: Payment[];
  issuer?: Pick<AuthUser, 'id' | 'name' | 'username'>;
  voided_by?: Pick<AuthUser, 'id' | 'name' | 'username'> | null;
  cash_session?: CashSession & {
    user?: Pick<AuthUser, 'id' | 'name' | 'username'>;
  };
  institutional_receipt?: InvoiceInstitutionalReceipt | null;
};

export type InvoiceInstitutionalReceipt = Pick<
  InstitutionalReceipt,
  'id' | 'receipt_number_full' | 'status' | 'issued_at' | 'reprint_count'
> & {
  print_events_count?: number;
  has_print_events?: boolean;
};

export type CashSession = {
  id: number;
  user_id: number;
  user?: Pick<AuthUser, 'id' | 'name' | 'username'>;
  opening_amount: string;
  closing_amount: string | null;
  expected_amount: string | null;
  difference_amount: string | null;
  status: 'open' | 'closed';
  opening_notes: string | null;
  closing_notes: string | null;
  opened_at: string;
  closed_at: string | null;
  payments_count?: number;
  payments_total?: string;
  payments_by_method?: MoneyByMethod;
  expected_cash_amount?: string;
  pending_invoice_count?: number;
  pending_amount?: string;
};

export type Payment = {
  id: number;
  invoice_id: number;
  cash_session_id: number;
  user_id: number;
  method: 'cash' | 'transfer' | 'card' | 'other';
  amount: string;
  reference: string | null;
  status: 'posted' | 'void';
  voided_by?: number | Pick<AuthUser, 'id' | 'name' | 'username'> | null;
  voided_at?: string | null;
  void_reason?: string | null;
  paid_at: string;
};

export type InstitutionalReceiptPaperSize = 'letter' | 'half_letter' | 'a5' | '80mm' | '58mm';
export type ReceiptPaperSize = InstitutionalReceiptPaperSize;

export type ReceiptData = {
  width: ReceiptPaperSize;
  hospital: {
    name: string;
    rtn: string | null;
    address?: string | null;
    slogan?: string | null;
  };
  institutional?: {
    template_mode: 'institutional' | string;
    paper_size: ReceiptPaperSize;
    government_line: string | null;
    secretariat_line: string | null;
    location: string | null;
    footer_text: string | null;
    copy_label: string | null;
    signature_label: string | null;
  };
  fiscal: {
    cai: string | null;
    authorized_range: string | null;
    valid_until: string | null;
  };
  invoice: Pick<
    Invoice,
    | 'id'
    | 'invoice_number'
    | 'patient_name'
    | 'subtotal'
    | 'tax_amount'
    | 'discount_amount'
    | 'total'
    | 'paid_amount'
    | 'balance_due'
    | 'status'
  > & {
    issued_at: string;
    cashier: string | null;
    tax_label?: string | null;
    tax_rate?: string | null;
  };
  items: Array<
    Pick<
      InvoiceItem,
      | 'service_name'
      | 'category_name'
      | 'quantity'
      | 'unit_price'
      | 'tax_amount'
      | 'line_total'
      | 'special_rule_code'
      | 'special_rule_applied'
      | 'notes'
    >
  >;
  payments: Array<Pick<Payment, 'id' | 'method' | 'amount' | 'reference' | 'paid_at'> & {
    cashier: string | null;
  }>;
};

export type InstitutionalReceipt = {
  id: number;
  invoice_id: number | null;
  payment_id: number | null;
  cash_session_id: number;
  series_id: number;
  receipt_number: number;
  receipt_number_full: string;
  status: 'issued' | 'void';
  amount: string;
  amount_cents: number;
  issued_at: string | null;
  issued_by: number;
  payer_name: string;
  concept: string;
  amount_words: string;
  template_code: 'institutional_classic';
  print_profile_code: ReceiptPrintProfile['code'];
  copy_mode: ReceiptPrintProfile['copies_mode'];
  reprint_count: number;
  voided_by: number | null;
  voided_at: string | null;
  void_reason: string | null;
};

export type PaymentRegistrationResult = {
  payment: Payment;
  invoice: Invoice;
  institutional_receipt: InstitutionalReceipt | null;
  institutional_receipt_error: string | null;
};

export type MoneyByMethod = {
  cash: string;
  transfer: string;
  card: string;
  other: string;
};

export type CashSessionReport = {
  cash_session: CashSession & {
    user?: Pick<AuthUser, 'id' | 'name' | 'username'>;
  };
  totals_by_method: MoneyByMethod;
  total_cash: string;
  total_transfer: string;
  total_card: string;
  total_other: string;
  payments_count: number;
  payments_total: string;
  expected_cash_amount: string;
  pending_invoice_count: number;
  pending_amount: string;
  payments: Array<Payment & {
    invoice?: Pick<
      Invoice,
      'id' | 'invoice_number' | 'patient_name' | 'status' | 'total' | 'paid_amount' | 'balance_due'
    >;
    user?: Pick<AuthUser, 'id' | 'name' | 'username'>;
  }>;
  movements: Array<{
    id: number;
    cash_session_id: number;
    payment_id: number | null;
    user_id: number;
    type: string;
    method: string | null;
    amount: string;
    notes: string | null;
    occurred_at: string;
    user?: Pick<AuthUser, 'id' | 'name' | 'username'>;
  }>;
};

export type BackupLog = {
  id: number;
  filename: string;
  size_bytes: number | null;
  checksum_sha256: string | null;
  status: 'pending' | 'success' | 'failed';
  type: 'manual' | 'scheduled';
  created_by: number | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  error_message?: string | null;
  creator?: Pick<AuthUser, 'id' | 'name' | 'username'> | null;
};

export type SystemStatus = {
  summary?: {
    severity: 'ok' | 'warning' | 'error';
    problem_count: number;
    label: string;
  };
  environment: {
    app_env: string;
    app_debug: boolean;
    app_url: string;
    queue_connection: string;
    filesystem_disk: string;
    app_version: string;
    php_version: string;
    server_time: string;
    timezone: string;
  };
  database: {
    connection: string;
    driver: string;
    connected: boolean;
    is_mysql_family: boolean;
  };
  frontend: {
    dist_index_exists: boolean;
    assets_present: boolean;
    assets_count: number;
    entry_label: string;
  };
  network: {
    configured_host: string | null;
    host_type: 'unknown' | 'loopback' | 'lan';
    lan_ready: boolean;
    client_url: string | null;
    guidance: string;
  };
  backups: {
    pending_count: number;
    worker_recently_active: boolean;
    oldest_pending_at?: string | null;
    stale_pending_count?: number;
    stale_pending_threshold_minutes?: number;
    last_success_at: string | null;
    last_success_filename: string | null;
    last_failure_at: string | null;
    last_failure_message: string | null;
    dump_binary: {
      configured: boolean;
      available: boolean;
      name: string | null;
    };
    storage: {
      writable: boolean;
      free_bytes: number | null;
    };
    queue: {
      connection: string;
      jobs_table_available: boolean;
      failed_jobs_table_available: boolean;
      failed_jobs_count: number | null;
      pending_backup_jobs: number | null;
      worker_command: string;
      scheduler_command: string;
    };
  };
  runtime: {
    logs_writable: boolean;
    cache_writable: boolean;
    laravel_log: {
      exists: boolean;
      size_bytes: number | null;
      modified_at: string | null;
    };
    backup_automation_log: {
      exists: boolean;
      size_bytes: number | null;
      modified_at: string | null;
    };
    frontend_build: {
      available: boolean;
      modified_at: string | null;
    };
    installed_version: string | null;
    latest_migration: string | null;
    migration_count: number | null;
    pending_migration_count: number | null;
    pending_migrations: string[];
  };
  readiness: {
    state: 'DEMO_READY' | 'PRODUCTION_CANDIDATE' | 'PRODUCTION_READY';
    production_ready: boolean;
    blockers: Array<{
      code: string;
      label: string;
      status: 'pending' | 'partial' | 'validated';
    }>;
  };
  preflight: {
    production_checks: Array<{
      code: string;
      label: string;
      status: 'pending' | 'partial' | 'validated' | 'manual_required';
      detail: string;
    }>;
    public_routes: Array<{
      path: string;
      expected: string;
      status: 'pending' | 'partial' | 'validated' | 'manual_required';
    }>;
    physical_proofs: Array<{
      code: string;
      label: string;
      required_file: string;
      status: 'pending' | 'partial' | 'validated' | 'manual_required';
      detail: string;
    }>;
    commands: {
      preflight: string;
      backup_worker: string;
      scheduler: string;
    };
  };
};

export type SystemStatusCheck = {
  code: string;
  label: string;
  status: 'validated' | 'warning' | 'error' | 'manual_required';
  detail: string;
};

export type SystemStatusSummary = {
  summary: {
    severity: 'ok' | 'warning' | 'error';
    problem_count: number;
    label: string;
    action: string;
  };
  checks: SystemStatusCheck[];
  advanced_available: boolean;
};

export type PaginatedMeta = {
  current_page: number;
  per_page: number;
  total: number;
};

export type ServiceFilters = {
  search?: string;
  code?: string;
  active?: boolean;
  billing?: boolean;
  categoryId?: number;
  areaId?: number;
  visibleInBilling?: boolean;
  isBillable?: boolean;
  page?: number;
  perPage?: number;
};

export type InvoiceFilters = {
  date_from?: string;
  date_to?: string;
  status?: Invoice['status'] | '';
  patient?: string;
  invoice_number?: string;
  user_id?: string;
  cash_session_id?: string;
  page?: number;
  per_page?: number;
};

export type ReportFilters = {
  date_from: string;
  date_to: string;
  cash_session_id?: string | number | null;
  user_id?: string | number | null;
  category_id?: string | number | null;
  area_id?: string | number | null;
  method?: Payment['method'] | '' | null;
  status?: Invoice['status'] | '' | null;
};

export type PdfReportFilters = ReportFilters & { date?: string };

export type TodayReport = {
  date: string;
  timezone: string;
  server_time: string;
  cash_session_open: boolean;
  cash_session_id: number | null;
  cash_session_opened_at: string | null;
  cash_session_opening_amount: string | null;
  issued_count: number;
  collected_count: number;
  billed: string;
  collected: string;
  pending: string;
  voided_count: number;
  voided_amount: string;
  reversal_count: number;
  pending_invoice_count: number;
  pending_invoice_amount: string;
  payments_by_method: MoneyByMethod;
  payments_count_by_method: {
    cash: number;
    transfer: number;
    card: number;
    other: number;
  };
  backup_pending: boolean;
  backup_pending_age_hours: number | null;
};

export type ExecutiveReportFilters = {
  date_from: string;
  date_to: string;
  cash_session_id?: number;
  user_id?: number;
  category_id?: number;
  area_id?: number;
  method?: 'cash' | 'transfer' | 'card' | 'other';
  status?: 'issued' | 'partial' | 'paid' | 'void';
};

export type ExecutiveReport = {
  period: {
    from: string;
    to: string;
    timezone: string;
    days: number;
  };
  filters: {
    cash_session_id: number | null;
    user_id: number | null;
    category_id: number | null;
    area_id: number | null;
    method: string | null;
    status: string | null;
  };
  comparison: {
    billed: {
      current: string;
      previous: string;
      delta_cents: number;
      delta_percentage: number | null;
    };
    collected: {
      current: string;
      previous: string;
      delta_cents: number;
      delta_percentage: number | null;
    };
    previous_period: { from: string; to: string };
  };
  summary: {
    billed_total: string;
    collected_total: string;
    collected_total_cents: number;
    pending_total: string;
    voided_total: string;
    reversed_total: string;
    invoice_count: number;
    receipt_count: number;
    paid_count: number;
    partial_count: number;
    pending_count: number;
    voided_count: number;
    average_ticket: string;
  };
  payment_methods: Array<{
    method: 'cash' | 'transfer' | 'card' | 'other';
    label: string;
    amount: string;
    count: number;
    percentage: number;
  }>;
  daily_trend: Array<{
    date: string;
    billed: string;
    collected: string;
    pending: string;
    voided_count: number;
    invoice_count: number;
  }>;
  services: {
    top_by_amount: Array<{
      service: string;
      category: string;
      item_count: number;
      quantity: string;
      total: string;
      collected: string;
    }>;
    top_by_quantity: Array<{
      service: string;
      category: string;
      item_count: number;
      quantity: string;
      total: string;
    }>;
    by_category: Array<{
      category: string;
      quantity: string;
      total: string;
      collected: string;
      item_count: number;
    }>;
    by_area: Array<{
      area_id: number | null;
      area: string;
      item_count: number;
      quantity: string;
      total: string;
    }>;
  };
  cashiers: Array<{
    user_id: number;
    name: string;
    username: string;
    invoice_count: number;
    payment_count: number;
    collected: string;
    cash: string;
    transfer: string;
    card: string;
    other: string;
    voided_count: number;
    difference_total: string;
  }>;
  cash_sessions: Array<{
    id: number;
    cashier: string;
    opened_at: string | null;
    closed_at: string | null;
    opening_amount: string;
    expected_cash: string;
    counted_cash: string | null;
    difference: string | null;
    status: string;
    closure_note: string | null;
  }>;
  pending_aging: {
    '0_7_days': { count: number; amount: string };
    '8_30_days': { count: number; amount: string };
    '31_plus_days': { count: number; amount: string };
    items: Array<{
      invoice_number: string;
      patient: string;
      total: string;
      balance_due: string;
      issued_at: string;
      age_days: number;
      bucket: '0_7_days' | '8_30_days' | '31_plus_days';
    }>;
  };
  voids_and_reversals: Array<{
    kind: 'void' | 'reversal';
    invoice_number: string;
    patient: string | null;
    amount: string;
    reason: string | null;
    user: string | null;
    authorized_by: string | null;
    created_at: string | null;
  }>;
  audit_summary: {
    critical_events: number;
    reprints: number;
    fiscal_changes: number;
    cash_differences: number;
    backup_events: number;
  };
};

export type DashboardReport = {
  last_7_days: Array<{
    date: string;
    total_billed: string;
    total_collected: string;
    total_pending?: string;
    total_partial?: string;
    total_voided?: string;
    invoice_count: number;
    payment_count: number;
  }>;
  current_month: {
    total_billed: string;
    total_collected: string;
    total_pending?: string;
    total_partial?: string;
    total_voided?: string;
    invoice_count: number;
    payment_count: number;
  };
  payments_by_method: MoneyByMethod;
  top_services: Array<{
    service_name: string;
    category_name: string;
    quantity: string;
    total: string;
  }>;
  cashiers_summary: Array<{
    user_id: number;
    name: string;
    username: string;
    payment_count: number;
    total_collected: string;
  }>;
};

export type AuditLogEntry = {
  id: number;
  action: string;
  result?: string | null;
  reason?: string | null;
  ip?: string | null;
  entity_type?: string | null;
  entity_id?: number | string | null;
  created_at?: string | null;
  user?: { id: number; name: string; username: string } | null;
};

export type AuditLogPage = {
  data: AuditLogEntry[];
  meta: PaginatedMeta;
};


export type OperationalHealth = {
  generated_at: string;
  database: {
    driver: string;
    connected: boolean;
    error?: string;
  };
  queue: {
    connection: string;
    pending: number;
    failed: number;
    error?: string;
  };
  backups: {
    worker_recently_active: boolean;
    pending: number;
    success_last_24h: number;
    failed_last_24h: number;
    error?: string;
  };
  storage: {
    backup_files: number;
    backup_bytes: number;
    error?: string;
  };
  recent_errors: Array<{
    id: number;
    action: string;
    entity_type: string;
    created_at: string;
  }>;
};

export type InstitutionalReceiptSeries = {
  id: number;
  document_type: 'institutional_receipt';
  series: string;
  prefix: string;
  number_format: string;
  min_number: number;
  max_number: number;
  current_number: number;
  range_authorization: string | null;
  legal_text: string | null;
  receipt_number_color: string;
  active: boolean;
  reprint_behavior: 'audit_only' | 'require_reason';
  void_behavior: 'permission_reason_audit';
};

export type ReceiptPrintProfile = {
  id: number;
  code: 'recibo_pequeno_personalizado' | 'media_carta_horizontal' | 'a5_horizontal' | 'carta_horizontal' | 'thermal_80mm' | 'thermal_58mm';
  name: string;
  paper_kind: 'custom_mm' | 'half_letter_landscape' | 'a5_landscape' | 'letter_landscape' | 'thermal_80mm' | 'thermal_58mm';
  width_mm: string;
  height_mm: string;
  margin_top_mm: string;
  margin_right_mm: string;
  margin_bottom_mm: string;
  margin_left_mm: string;
  orientation: 'landscape' | 'portrait';
  template_code: 'institutional_classic';
  font_family: string | null;
  font_scale: string;
  copies_mode: 'original_only' | 'original_first' | 'original_first_second';
  show_copy_legend: boolean;
  show_physical_seal_space: boolean;
  use_logo: boolean;
  show_technical_fields: boolean;
  active: boolean;
  is_global_default: boolean;
};

export type ReceiptProfileAssignment = {
  id: number;
  receipt_print_profile_id: number;
  scope_type: 'global' | 'user' | 'cash_session';
  scope_id: number | null;
  active: boolean;
  print_profile?: ReceiptPrintProfile;
};

export type InstitutionalReceiptSettings = {
  institution: FiscalSettings | null;
  active_series: InstitutionalReceiptSeries | null;
  series: InstitutionalReceiptSeries[];
  print_profiles: ReceiptPrintProfile[];
  assignments: ReceiptProfileAssignment[];
  resolved_profile: ReceiptPrintProfile | null;
};

export type ReceiptInstitutionPayload = {
  hospital_name: string;
  rtn?: string | null;
  address?: string | null;
  slogan?: string | null;
  government_line?: string | null;
  secretariat_line?: string | null;
  receipt_location?: string | null;
  receipt_footer_text?: string | null;
  receipt_template_mode?: 'institutional';
};

export type ReceiptSeriesPayload = {
  document_type?: 'institutional_receipt';
  series: string;
  prefix: string;
  number_format?: string;
  min_number: number;
  max_number: number;
  current_number: number;
  range_authorization?: string | null;
  legal_text?: string | null;
  receipt_number_color?: string;
  active: boolean;
  reprint_behavior?: 'audit_only' | 'require_reason';
  void_behavior?: 'permission_reason_audit';
};

export type ReceiptPrintProfilePayload = Partial<Pick<
  ReceiptPrintProfile,
  | 'name'
  | 'paper_kind'
  | 'width_mm'
  | 'height_mm'
  | 'margin_top_mm'
  | 'margin_right_mm'
  | 'margin_bottom_mm'
  | 'margin_left_mm'
  | 'orientation'
  | 'template_code'
  | 'font_family'
  | 'font_scale'
  | 'copies_mode'
  | 'show_copy_legend'
  | 'show_physical_seal_space'
  | 'use_logo'
  | 'show_technical_fields'
  | 'active'
  | 'is_global_default'
>>;

export type ReceiptTestPrintPayload = {
  profile_id?: number;
  profile_code?: ReceiptPrintProfile['code'];
  payer_name?: string;
  concept?: string;
  amount?: string;
};
