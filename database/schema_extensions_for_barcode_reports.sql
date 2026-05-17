-- Schema extensions proposed for Fase 12C and Fase 12D
-- Review with Laravel migrations before applying.

ALTER TABLE services
  ADD COLUMN sku VARCHAR(80) NULL AFTER source_hash,
  ADD COLUMN barcode VARCHAR(120) NULL AFTER sku,
  ADD COLUMN qr_code VARCHAR(120) NULL AFTER barcode,
  ADD COLUMN scan_code VARCHAR(120) NULL AFTER qr_code;

CREATE UNIQUE INDEX services_sku_unique ON services (sku);
CREATE UNIQUE INDEX services_barcode_unique ON services (barcode);
CREATE UNIQUE INDEX services_qr_code_unique ON services (qr_code);
CREATE UNIQUE INDEX services_scan_code_unique ON services (scan_code);

-- Optional reporting indexes; adjust names if existing migrations already cover them.
CREATE INDEX invoice_items_service_name_idx ON invoice_items (service_name);
CREATE INDEX invoices_status_issued_at_idx ON invoices (status, issued_at);
CREATE INDEX payments_method_paid_at_idx ON payments (method, paid_at);
