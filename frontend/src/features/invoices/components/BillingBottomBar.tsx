import { Button } from 'antd';

export type BillingBottomBarProps = {
  itemCount: number;
  total: string;
  onOpen: () => void;
};

export function BillingBottomBar({ itemCount, total, onOpen }: BillingBottomBarProps) {
  const serviceLabel = itemCount === 1 ? '1 servicio' : `${itemCount} servicios`;

  return (
    <div
      data-audit-panel="billing-bottom-bar"
      className="fixed inset-x-0 bottom-16 z-30 border-t border-operational-border bg-operational-surface p-3 lg:bottom-0 xl:hidden"
    >
      <Button
        type="primary"
        block
        data-billing-account-trigger
        onClick={onOpen}
        aria-label={`Ver cuenta, ${serviceLabel}, total L ${total}`}
        className="flex min-h-12 items-center gap-3"
      >
        <span>{serviceLabel}</span>
        <strong className="ml-auto font-mono tabular-nums">L {total}</strong>
        <span>Ver cuenta</span>
      </Button>
    </div>
  );
}
