-- database_schema_critico.sql
-- Propuesta crítica para S_Hospital Offline

CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NULL UNIQUE,
  username VARCHAR(80) NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL
);

CREATE TABLE settings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(120) NOT NULL UNIQUE,
  `value` TEXT NULL,
  value_type VARCHAR(30) NOT NULL DEFAULT 'string',
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL
);

CREATE TABLE categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  slug VARCHAR(140) NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL
);

CREATE TABLE services (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(190) NOT NULL,
  price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  taxable BOOLEAN NOT NULL DEFAULT TRUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  special_rule_code VARCHAR(80) NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  CONSTRAINT fk_services_category FOREIGN KEY (category_id) REFERENCES categories(id),
  UNIQUE KEY uq_services_category_name (category_id, name),
  INDEX idx_services_category_active (category_id, active)
);

CREATE TABLE fiscal_sequences (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  document_type VARCHAR(40) NOT NULL UNIQUE,
  prefix VARCHAR(40) NOT NULL DEFAULT '000-001-01',
  current_number BIGINT UNSIGNED NOT NULL DEFAULT 0,
  min_number BIGINT UNSIGNED NOT NULL DEFAULT 1,
  max_number BIGINT UNSIGNED NOT NULL DEFAULT 99999999,
  cai VARCHAR(120) NULL,
  valid_until DATE NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL
);

CREATE TABLE cash_register_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  opened_by BIGINT UNSIGNED NOT NULL,
  closed_by BIGINT UNSIGNED NULL,
  opened_at DATETIME NOT NULL,
  closed_at DATETIME NULL,
  opening_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  closing_amount DECIMAL(12,2) NULL,
  expected_amount DECIMAL(12,2) NULL,
  difference_amount DECIMAL(12,2) NULL,
  status ENUM('open','closed') NOT NULL DEFAULT 'open',
  notes TEXT NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  CONSTRAINT fk_cash_opened_by FOREIGN KEY (opened_by) REFERENCES users(id),
  CONSTRAINT fk_cash_closed_by FOREIGN KEY (closed_by) REFERENCES users(id),
  INDEX idx_cash_status_opened (status, opened_at)
);

CREATE TABLE invoices (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(60) NOT NULL UNIQUE,
  fiscal_sequence_id BIGINT UNSIGNED NULL,
  patient_name VARCHAR(190) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  status ENUM('draft','issued','paid','partial','void') NOT NULL DEFAULT 'issued',
  issued_by BIGINT UNSIGNED NOT NULL,
  cash_session_id BIGINT UNSIGNED NULL,
  issued_at DATETIME NOT NULL,
  voided_by BIGINT UNSIGNED NULL,
  voided_at DATETIME NULL,
  void_reason TEXT NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  CONSTRAINT fk_invoice_sequence FOREIGN KEY (fiscal_sequence_id) REFERENCES fiscal_sequences(id),
  CONSTRAINT fk_invoice_user FOREIGN KEY (issued_by) REFERENCES users(id),
  CONSTRAINT fk_invoice_cash FOREIGN KEY (cash_session_id) REFERENCES cash_register_sessions(id),
  CONSTRAINT fk_invoice_voided_by FOREIGN KEY (voided_by) REFERENCES users(id),
  INDEX idx_invoices_issued_at (issued_at),
  INDEX idx_invoices_patient (patient_name),
  INDEX idx_invoices_status (status),
  INDEX idx_invoices_cash (cash_session_id)
);

CREATE TABLE invoice_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id BIGINT UNSIGNED NOT NULL,
  service_id BIGINT UNSIGNED NULL,
  category_name VARCHAR(120) NOT NULL,
  service_name VARCHAR(190) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 15.00,
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  line_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  special_rule_applied VARCHAR(120) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  CONSTRAINT fk_item_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  CONSTRAINT fk_item_service FOREIGN KEY (service_id) REFERENCES services(id),
  INDEX idx_items_invoice (invoice_id),
  INDEX idx_items_service (service_id)
);

CREATE TABLE payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id BIGINT UNSIGNED NOT NULL,
  cash_session_id BIGINT UNSIGNED NOT NULL,
  received_by BIGINT UNSIGNED NOT NULL,
  method ENUM('cash','transfer','card','other') NOT NULL DEFAULT 'cash',
  amount DECIMAL(12,2) NOT NULL,
  reference VARCHAR(190) NULL,
  paid_at DATETIME NOT NULL,
  status ENUM('valid','void') NOT NULL DEFAULT 'valid',
  voided_by BIGINT UNSIGNED NULL,
  voided_at DATETIME NULL,
  void_reason TEXT NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  CONSTRAINT fk_payment_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  CONSTRAINT fk_payment_cash FOREIGN KEY (cash_session_id) REFERENCES cash_register_sessions(id),
  CONSTRAINT fk_payment_user FOREIGN KEY (received_by) REFERENCES users(id),
  INDEX idx_payments_invoice (invoice_id),
  INDEX idx_payments_paid_at (paid_at),
  INDEX idx_payments_cash (cash_session_id)
);

CREATE TABLE cash_movements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cash_session_id BIGINT UNSIGNED NOT NULL,
  payment_id BIGINT UNSIGNED NULL,
  type ENUM('opening','payment','withdrawal','adjustment','closing') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  description VARCHAR(255) NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  CONSTRAINT fk_movement_cash FOREIGN KEY (cash_session_id) REFERENCES cash_register_sessions(id),
  CONSTRAINT fk_movement_payment FOREIGN KEY (payment_id) REFERENCES payments(id),
  CONSTRAINT fk_movement_user FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_movements_cash (cash_session_id),
  INDEX idx_movements_type (type)
);

CREATE TABLE audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  action VARCHAR(120) NOT NULL,
  auditable_type VARCHAR(190) NULL,
  auditable_id BIGINT UNSIGNED NULL,
  old_values JSON NULL,
  new_values JSON NULL,
  ip_address VARCHAR(64) NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMP NULL,
  INDEX idx_audit_subject (auditable_type, auditable_id),
  INDEX idx_audit_user_created (user_id, created_at)
);

CREATE TABLE backup_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  path VARCHAR(500) NOT NULL,
  size_bytes BIGINT UNSIGNED NULL,
  status ENUM('success','failed') NOT NULL,
  message TEXT NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NULL,
  CONSTRAINT fk_backup_user FOREIGN KEY (created_by) REFERENCES users(id)
);
