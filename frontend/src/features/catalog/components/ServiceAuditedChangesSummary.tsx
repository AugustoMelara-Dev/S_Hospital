import { AdminCallout, MoneyText } from '@/design-system/admin/components';
import { parseCents, type Cents } from '@/lib/moneyCents';

export type AuditedServiceSource = {
  active: boolean;
  is_billable?: boolean | null;
  price: string;
  taxable: boolean;
  visible_in_billing?: boolean | null;
};

export type AuditedServiceDraft = {
  active: boolean;
  is_billable: boolean;
  price: string;
  taxable: boolean;
  visible_in_billing: boolean;
};

/**
 * Un cambio auditado. El dinero nunca viaja como texto: el importe queda en
 * centavos y la vista lo dibuja con `MoneyText` (`L` y monto juntos,
 * `tabular-nums`).
 */
export type AuditedServiceChange = {
  id: string;
  label: string;
  beforeText: string | null;
  afterText: string | null;
  beforeCents: Cents | null;
  afterCents: Cents | null;
};

export function auditedServiceChanges(
  service: AuditedServiceSource,
  draft: AuditedServiceDraft,
): AuditedServiceChange[] {
  const changes: AuditedServiceChange[] = [];

  if (priceValuesDiffer(service.price, draft.price)) {
    changes.push({
      id: 'price',
      label: 'Tarifa',
      beforeText: null,
      afterText: null,
      beforeCents: parseCents(service.price),
      afterCents: parseCents(draft.price),
    });
  }

  if (service.taxable !== draft.taxable) {
    changes.push(textChange('tax', 'ISV', taxLabel(service.taxable), taxLabel(draft.taxable)));
  }

  if (service.active !== draft.active) {
    changes.push(textChange('active', 'Servicio activo', yesNo(service.active), yesNo(draft.active)));
  }

  if ((service.visible_in_billing ?? true) !== draft.visible_in_billing) {
    changes.push(
      textChange(
        'visible_in_billing',
        'Visible en caja',
        yesNo(service.visible_in_billing ?? true),
        yesNo(draft.visible_in_billing),
      ),
    );
  }

  if ((service.is_billable ?? true) !== draft.is_billable) {
    changes.push(
      textChange(
        'is_billable',
        'Facturable',
        yesNo(service.is_billable ?? true),
        yesNo(draft.is_billable),
      ),
    );
  }

  return changes;
}

export function ServiceAuditedChangesSummary({ changes }: { changes: AuditedServiceChange[] }) {
  return (
    <AdminCallout tone="warn" title="Cambios auditados">
      <p className="text-[length:var(--ui-text-xs)] leading-5 text-[color:var(--ui-ink-soft)]">
        Estos cambios requieren un motivo y quedan registrados en la auditoría.
      </p>
      <ul className="mt-3 flex flex-col gap-1 text-[length:var(--ui-text-xs)]">
        {changes.map((change) => (
          <li key={change.id} className="flex flex-wrap items-baseline gap-1.5">
            <span className="font-medium">{change.label}:</span>
            <ChangeValue cents={change.beforeCents} text={change.beforeText} />
            <span aria-hidden="true">→</span>
            <span className="sr-only">cambia a</span>
            <ChangeValue cents={change.afterCents} text={change.afterText} />
          </li>
        ))}
      </ul>
    </AdminCallout>
  );
}

function ChangeValue({ cents, text }: { cents: Cents | null; text: string | null }) {
  if (cents !== null) {
    return <MoneyText cents={cents} emphasis="strong" />;
  }

  return <span>{text ?? 'Sin tarifa válida'}</span>;
}

function textChange(id: string, label: string, beforeText: string, afterText: string): AuditedServiceChange {
  return { id, label, beforeText, afterText, beforeCents: null, afterCents: null };
}

export function priceValuesDiffer(current: string, next: string): boolean {
  const currentCents = parseCents(current);
  const nextCents = parseCents(next);

  return currentCents !== null && nextCents !== null && currentCents !== nextCents;
}

function taxLabel(value: boolean): string {
  return value ? 'Aplica' : 'No aplica';
}

function yesNo(value: boolean): string {
  return value ? 'Sí' : 'No';
}
