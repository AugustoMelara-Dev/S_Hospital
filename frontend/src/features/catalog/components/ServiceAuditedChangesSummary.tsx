import { priceCents } from './serviceSheetTypes';

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

export function auditedServiceChanges(
  service: AuditedServiceSource,
  draft: AuditedServiceDraft,
): string[] {
  const changes: string[] = [];

  if (priceValuesDiffer(service.price, draft.price)) {
    changes.push(`Precio: ${formatAuditPrice(service.price)} -> ${formatAuditPrice(draft.price)}`);
  }

  if (service.taxable !== draft.taxable) {
    changes.push(`ISV: ${taxLabel(service.taxable)} -> ${taxLabel(draft.taxable)}`);
  }

  if (service.active !== draft.active) {
    changes.push(`Servicio activo: ${yesNo(service.active)} -> ${yesNo(draft.active)}`);
  }

  if ((service.visible_in_billing ?? true) !== draft.visible_in_billing) {
    changes.push(`Visible en caja: ${yesNo(service.visible_in_billing ?? true)} -> ${yesNo(draft.visible_in_billing)}`);
  }

  if ((service.is_billable ?? true) !== draft.is_billable) {
    changes.push(`Facturable: ${yesNo(service.is_billable ?? true)} -> ${yesNo(draft.is_billable)}`);
  }

  return changes;
}

export function ServiceAuditedChangesSummary({ changes }: { changes: string[] }) {
  return (
    <section
      aria-label="Cambios auditados"
      className="rounded-md border border-warning/40 bg-warning/10 p-4 text-sm text-warning-foreground"
    >
      <h3 className="font-semibold">Cambios auditados</h3>
      <p className="mt-1 text-xs leading-5 text-current/80">
        El backend exigira motivo y guardara auditoria para estos cambios.
      </p>
      <ul className="mt-3 space-y-1 text-xs">
        {changes.map((change) => (
          <li key={change}>{change}</li>
        ))}
      </ul>
    </section>
  );
}

export function priceValuesDiffer(current: string, next: string): boolean {
  const currentCents = priceCents(current);
  const nextCents = priceCents(next);

  return currentCents !== null && nextCents !== null && currentCents !== nextCents;
}

function formatAuditPrice(value: string): string {
  const cents = priceCents(value);

  if (cents === null) {
    return `L. ${value}`;
  }

  return `L. ${(cents / 100).toFixed(2)}`;
}

function taxLabel(value: boolean): string {
  return value ? 'Aplica' : 'No aplica';
}

function yesNo(value: boolean): string {
  return value ? 'Si' : 'No';
}
