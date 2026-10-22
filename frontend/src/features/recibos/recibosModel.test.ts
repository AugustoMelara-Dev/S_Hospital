import { describe, expect, it } from 'vitest';
import type { Invoice, InvoiceItem } from '@/lib/api';
import {
  LINE_ADJUSTMENT_UNAVAILABLE,
  activeFilterChips,
  copiesFromMode,
  copiesLabel,
  documentView,
  hasRuleAdjustment,
  itemAdjustmentLabel,
  lineAdjustmentView,
  paymentStateView,
  printInfoText,
  resultCountLabel,
  resultRangeLabel,
  type RecibosLine,
} from './recibosModel';

function item(overrides: Partial<InvoiceItem> = {}): InvoiceItem {
  return {
    id: 1,
    service_id: 1,
    service_name: 'Servicio',
    category_id: 1,
    category_name: 'Categoría',
    quantity: '1.00',
    unit_price: '100.00',
    tax_rate: '15.00',
    tax_amount: '15.00',
    line_subtotal: '100.00',
    line_total: '115.00',
    special_rule_code: null,
    special_rule_applied: false,
    notes: null,
    ...overrides,
  };
}

/** Línea con el bloque de ajuste, tal como puede llegar del servidor. */
function laxItem(overrides: Partial<RecibosLine> = {}): RecibosLine {
  return { ...item(), ...overrides };
}

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 1,
    invoice_number: '000-001-01-00000001',
    patient_name: 'Paciente Recibos',
    subtotal: '100.00',
    tax_amount: '15.00',
    discount_amount: '0.00',
    total: '115.00',
    paid_amount: '115.00',
    balance_due: '0.00',
    status: 'paid',
    issued_at: '2026-09-18T12:00:00.000000Z',
    items: [item()],
    ...overrides,
  };
}

function institutionalReceipt(
  overrides: Partial<NonNullable<Invoice['institutional_receipt']>> = {},
): NonNullable<Invoice['institutional_receipt']> {
  return {
    id: 90,
    receipt_number_full: 'REC-A-00000090',
    status: 'issued',
    issued_at: '2026-09-18T12:05:00.000000Z',
    reprint_count: 0,
    copy_mode: 'original_only',
    ...overrides,
  };
}

describe('recibosModel', () => {
  it('muestra el tipo real del documento vinculado', () => {
    expect(documentView(invoice({ institutional_receipt: institutionalReceipt() }))).toMatchObject({
      kind: 'institutional',
      label: 'Comprobante institucional',
      receiptNumber: 'REC-A-00000090',
    });

    expect(documentView(invoice({ status: 'paid', institutional_receipt: null }))).toMatchObject({
      kind: 'pending_receipt',
      label: 'Comprobante pendiente',
    });

    expect(documentView(invoice({ status: 'issued', paid_amount: '0.00', balance_due: '115.00' }))).toMatchObject({
      kind: 'without_receipt',
    });

    expect(documentView(invoice({ status: 'void' }))).toMatchObject({ kind: 'void' });
  });

  it('nunca presenta la gratuidad como un cobro y usa texto explícito', () => {
    expect(paymentStateView(invoice({ status: 'paid', total: '0.00', paid_amount: '0.00' }))).toEqual({
      status: 'gratuito',
      label: 'Emitida sin cobro',
    });
    expect(paymentStateView(invoice({ status: 'paid', total: '115.00' })).label).toBe('Cobrada');
    expect(paymentStateView(invoice({ status: 'partial' })).label).toBe('Pago parcial');
    expect(paymentStateView(invoice({ status: 'issued' })).label).toBe('Pendiente de cobro');
    expect(paymentStateView(invoice({ status: 'void' })).label).toBe('Anulada');
  });

  it('describe el ajuste por regla solo cuando la línea lo aplicó', () => {
    const applied = item({
      special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
      special_rule_applied: true,
    });
    expect(itemAdjustmentLabel(applied)).toMatch(/solo este medicamento/i);
    expect(hasRuleAdjustment(invoice({ items: [applied] }))).toBe(true);

    const codedButNotApplied = item({ special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION' });
    expect(itemAdjustmentLabel(codedButNotApplied)).toMatch(/esta línea se cobra/i);
    // Sin códigos internos en el copy de mostrador.
    expect(itemAdjustmentLabel(codedButNotApplied)).not.toMatch(/ERYTHROPOIETIN/);
    expect(itemAdjustmentLabel(item())).toBeNull();
  });

  it('muestra el ajuste real de la línea cuando el servidor lo entrega', () => {
    const adjusted = laxItem({
      special_rule_applied: true,
      rule_adjustment_cents: 250000,
      rule_adjustment_persisted: true,
    });

    expect(lineAdjustmentView(adjusted)).toEqual({ kind: 'adjustment', cents: 250000 });
  });

  it('declara el ajuste histórico no disponible en vez de pintar un cero', () => {
    const ruledWithoutField = laxItem({
      special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
      special_rule_applied: true,
    });

    expect(lineAdjustmentView(ruledWithoutField)).toEqual({ kind: 'unavailable' });
    expect(LINE_ADJUSTMENT_UNAVAILABLE).toBe('Dato histórico no disponible');

    // El contrato marca el documento histórico: un cero persistido no se pinta.
    const notPersisted = laxItem({
      special_rule_applied: true,
      rule_adjustment_cents: 0,
      rule_adjustment_persisted: false,
    });
    expect(lineAdjustmentView(notPersisted)).toEqual({ kind: 'unavailable' });

    // Campo presente pero ilegible: tampoco se convierte en cero.
    expect(lineAdjustmentView(laxItem({ rule_adjustment_cents: 'sin-dato' }))).toEqual({ kind: 'none' });

    const ruledUnreadable = laxItem({ special_rule_applied: true, rule_adjustment_cents: null });
    expect(lineAdjustmentView(ruledUnreadable)).toEqual({ kind: 'unavailable' });
  });

  it('trata un ajuste explícito de cero como ausencia de ajuste, no como importe', () => {
    expect(lineAdjustmentView(laxItem({ rule_adjustment_cents: 0, rule_adjustment_persisted: true }))).toEqual({
      kind: 'none',
    });
    // Una línea sin regla no lleva ajuste: la celda queda vacía, no «no disponible».
    expect(lineAdjustmentView(item())).toEqual({ kind: 'none' });
  });

  it('lee el contrato real por línea del detalle de factura (C2-B8, detalle-factura-19)', () => {
    // Payload real de `GET /api/invoices/19` sobre datos sintéticos:
    // Eritropoyetina con precio registrado 2500 y ajuste 2500 (magnitud
    // positiva, total de la línea), y una línea normal con 0 exacto.
    const erythropoietin = laxItem({
      service_name: 'Eritropoyetina',
      unit_price: '0.00',
      unit_price_registered_cents: 2500,
      rule_adjustment_cents: 2500,
      rule_adjustment_persisted: true,
      special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
      special_rule_applied: true,
      line_total: '0.00',
    });
    const normal = laxItem({
      service_name: 'Abdomen Embarazo',
      unit_price: '45.00',
      unit_price_registered_cents: 4500,
      rule_adjustment_cents: 0,
      rule_adjustment_persisted: true,
      line_total: '517.50',
    });

    expect(lineAdjustmentView(erythropoietin)).toEqual({ kind: 'adjustment', cents: 2500 });
    expect(lineAdjustmentView(normal)).toEqual({ kind: 'none' });
  });

  it('informa ejemplares y deja claro que abrir el PDF no vuelve a cobrar', () => {
    const text = printInfoText(1);
    expect(text).toMatch(/1 ejemplar/i);
    expect(text).toMatch(/se abrirá el PDF/i);
    expect(text).toMatch(/no registra otro cobro ni emite otro número de recibo/i);
    expect(text).not.toMatch(/conceptos|conteo de páginas|plantilla/i);
    expect(printInfoText(null, 'original_first')).toMatch(/2 ejemplares/i);
  });

  it('traduce el modo de copias y su etiqueta', () => {
    expect(copiesFromMode('original_only')).toBe(1);
    expect(copiesFromMode('original_first')).toBe(2);
    expect(copiesFromMode('original_first_second')).toBe(3);
    expect(copiesFromMode(undefined)).toBeNull();
    expect(copiesLabel(1)).toBe('1 ejemplar');
    expect(copiesLabel(2)).toBe('2 ejemplares');
    expect(copiesLabel(null)).toMatch(/perfil de impresión/i);
  });

  it('cuenta resultados en singular y plural', () => {
    expect(resultCountLabel(1)).toBe('1 operación');
    expect(resultCountLabel(3)).toBe('3 operaciones');
  });

  it('informa el rango visible de la página sin repetir el total como segundo contador', () => {
    expect(resultRangeLabel({ current_page: 1, per_page: 10, total: 42 })).toBe('1–10 de 42');
    expect(resultRangeLabel({ current_page: 5, per_page: 10, total: 42 })).toBe('41–42 de 42');
    expect(resultRangeLabel({ current_page: 1, per_page: 10, total: 0 })).toBe('Sin operaciones');
  });

  it('resume los filtros aplicados como contexto de cabecera', () => {
    expect(activeFilterChips({ page: 1, per_page: 10 })).toEqual([]);

    expect(
      activeFilterChips({
        page: 1,
        per_page: 10,
        patient: 'María López',
        date_from: '2026-09-01',
        date_to: '2026-09-18',
        status: 'paid',
        cash_session_id: '4',
      }),
    ).toEqual([
      { key: 'query', label: 'Paciente María López' },
      { key: 'range', label: '01/09/2026 – 18/09/2026' },
      { key: 'status', label: 'Pagada' },
      { key: 'cash', label: 'Caja #4' },
    ]);

    expect(activeFilterChips({ page: 1, per_page: 10, invoice_number: '000-001-01-00000010' })).toEqual([
      { key: 'query', label: 'Documento 000-001-01-00000010' },
    ]);
  });
});
