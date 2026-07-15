import type { ReactNode } from 'react';
import { CloseOutlined } from '@ant-design/icons';
import { Button, Drawer } from 'antd';

export type BillingAccountDrawerProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function BillingAccountDrawer({ open, onClose, children }: BillingAccountDrawerProps) {
  return (
    <Drawer
      title="Cuenta actual"
      open={open}
      onClose={onClose}
      size="min(100vw, 480px)"
      placement="right"
      className="billing-account-drawer"
      closable={false}
      extra={(
        <Button type="text" icon={<CloseOutlined aria-hidden="true" />} onClick={onClose}>
          Cerrar cuenta
        </Button>
      )}
    >
      <div data-billing-region="ticket">{children}</div>
    </Drawer>
  );
}
