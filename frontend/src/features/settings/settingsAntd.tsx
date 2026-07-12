import {
  Alert as AntAlert,
  Button as AntButton,
  Card as AntCard,
  Input as AntInput,
  Modal,
  Switch as AntSwitch,
  Tag,
  Typography,
  type ButtonProps,
  type InputRef,
} from 'antd';
import {
  cloneElement,
  createContext,
  forwardRef,
  isValidElement,
  useContext,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';

// ─── Input adapters ─────────────────────────────────────────────────────────

export const Input = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & { size?: 'small' | 'middle' | 'large' }
>(({ size, ...props }, ref) => (
  <AntInput
    size={size}
    {...props}
    ref={(instance: InputRef | null) => {
      if (typeof ref === 'function') ref(instance?.input ?? null);
      else if (ref) ref.current = instance?.input ?? null;
    }}
  />
));
Input.displayName = 'SettingsInput';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  (props, ref) => (
    <AntInput.TextArea
      {...props}
      ref={(instance) => {
        const element = instance?.resizableTextArea?.textArea ?? null;
        if (typeof ref === 'function') ref(element);
        else if (ref) ref.current = element;
      }}
    />
  ),
);
Textarea.displayName = 'SettingsTextarea';

// ─── Card primitives ─────────────────────────────────────────────────────────

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <AntCard className={className}>{children}</AntCard>;
}
export function CardHeader({ children }: { children: ReactNode; className?: string }) {
  return <div className="mb-4">{children}</div>;
}
export function CardContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}
export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <Typography.Title level={2} className={className}>{children}</Typography.Title>;
}
export function CardDescription({ children }: { children: ReactNode }) {
  return <Typography.Text type="secondary">{children}</Typography.Text>;
}

// ─── Button ──────────────────────────────────────────────────────────────────

export function Button({
  asChild,
  children,
  variant,
  size,
  type = 'button',
  ...props
}: Omit<ButtonProps, 'size' | 'type' | 'htmlType' | 'variant'> & {
  asChild?: boolean;
  variant?: string;
  size?: string;
  type?: 'button' | 'submit';
}) {
  if (asChild && isValidElement(children)) return cloneElement(children as ReactElement);
  return (
    <AntButton
      {...props}
      htmlType={type}
      size={size === 'lg' ? 'large' : size === 'sm' ? 'small' : 'middle'}
      danger={variant === 'destructive'}
      type={variant === 'outline' || variant === 'secondary' ? 'default' : 'primary'}
    >
      {children}
    </AntButton>
  );
}

// ─── Alert ───────────────────────────────────────────────────────────────────

export function Alert({ children, title, variant }: { children?: ReactNode; title?: ReactNode; variant?: string }) {
  return (
    <AntAlert
      showIcon
      type={variant === 'destructive' ? 'error' : 'info'}
      title={title}
      description={children}
    />
  );
}
export function AlertTitle({ children }: { children: ReactNode }) { return <strong>{children}</strong>; }
export function AlertDescription({ children }: { children: ReactNode }) { return <div>{children}</div>; }

// ─── Form primitives ─────────────────────────────────────────────────────────

// This is a plain passthrough <label>. Callers must supply htmlFor pointing to a valid control.
// eslint-disable-next-line jsx-a11y/label-has-associated-control
export function Label(props: LabelHTMLAttributes<HTMLLabelElement>) { return <label {...props} />; }

type FieldRender = (props: { id: string; invalid: boolean; describedBy: string | undefined }) => ReactNode;

export function FormField({
  children,
  error,
  htmlFor,
  id: suppliedId,
  label,
}: {
  children: ReactNode | FieldRender;
  error?: string;
  htmlFor?: string;
  id?: string;
  label: string;
  hint?: ReactNode;
  required?: boolean;
}) {
  const id = suppliedId ?? htmlFor ?? label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {typeof children === 'function'
        ? children({ id, invalid: Boolean(error), describedBy: error ? `${id}-error` : undefined })
        : children}
      {error ? <div id={`${id}-error`} role="alert">{error}</div> : null}
    </div>
  );
}

export function FormSection({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description?: ReactNode;
  title?: ReactNode;
  className?: string;
}) {
  return (
    <section>
      <Typography.Title level={3}>{title}</Typography.Title>
      {description ? <Typography.Text type="secondary">{description}</Typography.Text> : null}
      {children}
    </section>
  );
}

// ─── Switch ───────────────────────────────────────────────────────────────────

export function Switch(
  props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { onCheckedChange?: (checked: boolean) => void },
) {
  return (
    <AntSwitch
      id={props.id}
      checked={Boolean(props.checked)}
      disabled={props.disabled}
      onChange={(checked) => props.onCheckedChange?.(checked)}
      aria-label={props['aria-label']}
    />
  );
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

export function StatusBadge({ children, status }: { children: ReactNode; status: string }) {
  const color =
    status === 'success' || status === 'active' ? 'green'
    : status === 'failed' ? 'red'
    : 'gold';
  return <Tag color={color}>{children}</Tag>;
}

// ─── ConfirmDialog ───────────────────────────────────────────────────────────

export function ConfirmDialog({
  cancelDisabled,
  children,
  confirmDisabled,
  confirmLabel,
  onCancel,
  onConfirm,
  open,
  title,
}: {
  cancelDisabled?: boolean;
  children: ReactNode;
  confirmDisabled?: boolean;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onCancel={onCancel}
      onOk={onConfirm}
      okText={confirmLabel}
      cancelButtonProps={{ disabled: cancelDisabled }}
      okButtonProps={{ disabled: confirmDisabled }}
      modalRender={(node) => <div role="alertdialog" aria-label={title}>{node}</div>}
    >
      {children}
    </Modal>
  );
}

// ─── ActionBar / PageHeader ──────────────────────────────────────────────────

export function ActionBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
  align?: string;
  fullWidthOnMobile?: boolean;
}) {
  return <div className={className}>{children}</div>;
}

export function PageHeader({
  actions,
  description,
  title,
}: {
  actions?: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <header className="border-b border-border p-5">
      <Typography.Title level={1}>{title}</Typography.Title>
      {description ? <Typography.Text type="secondary">{description}</Typography.Text> : null}
      {actions}
    </header>
  );
}

// ─── Tabs (stateful, value + onValueChange) ──────────────────────────────────

const TabsContext = createContext<{ value?: string; onValueChange?: (value: string) => void }>({});

export function Tabs({
  children,
  value,
  onValueChange,
  className,
}: {
  children: ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return <div role="tablist" className={className}>{children}</div>;
}

export function TabsTrigger({ children, value }: { children: ReactNode; value: string }) {
  const { value: selectedValue, onValueChange } = useContext(TabsContext);
  return (
    <AntButton
      role="tab"
      aria-selected={selectedValue === value}
      onClick={() => onValueChange?.(value)}
      type={selectedValue === value ? 'primary' : 'default'}
    >
      {children}
    </AntButton>
  );
}

export function TabsContent({
  children,
  value,
  className,
}: {
  children: ReactNode;
  value: string;
  className?: string;
}) {
  const { value: selectedValue } = useContext(TabsContext);
  return selectedValue === value ? <div className={className}>{children}</div> : null;
}
