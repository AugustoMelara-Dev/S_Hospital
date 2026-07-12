import { Button as AntButton, Card as AntCard, Flex, Tag, Typography, type ButtonProps } from 'antd';
import type { ReactNode } from 'react';
export function Card({ children, className }: { children: ReactNode; className?: string }) { return <AntCard className={className}>{children}</AntCard>; }
export function CardHeader({ children }: { children: ReactNode; className?: string }) { return <div className="mb-4">{children}</div>; }
export function CardContent({ children, className }: { children: ReactNode; className?: string }) { return <div className={className}>{children}</div>; }
export function CardTitle({ children, className }: { children: ReactNode; className?: string }) { return <Typography.Title level={2} className={className}>{children}</Typography.Title>; }
export function CardDescription({ children }: { children: ReactNode }) { return <Typography.Text type="secondary">{children}</Typography.Text>; }
export function ActionBar({ children }: { children: ReactNode; align?: string; fullWidthOnMobile?: boolean }) { return <Flex gap="small" wrap>{children}</Flex>; }
export function Button({ variant, size, type = 'button', ...props }: Omit<ButtonProps, 'size' | 'type' | 'htmlType' | 'variant'> & { variant?: string; size?: 'sm' | 'lg'; type?: 'button' | 'submit' }) { return <AntButton {...props} htmlType={type} size={size === 'lg' ? 'large' : size === 'sm' ? 'small' : 'middle'} type={variant === 'secondary' ? 'default' : 'primary'} />; }
export function StatusBadge({ children, status }: { children: ReactNode; status: string }) { return <Tag color={status === 'success' || status === 'active' ? 'green' : status === 'failed' ? 'red' : 'gold'}>{children}</Tag>; }
export function PageHeader({ description, title }: { description: string; title: string }) { return <header className="border-b border-border p-5"><Typography.Title id="about-title" level={1}>{title}</Typography.Title><Typography.Text type="secondary">{description}</Typography.Text></header>; }
