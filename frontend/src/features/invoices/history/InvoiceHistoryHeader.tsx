import { FileTextOutlined } from '@ant-design/icons';
import { Flex, Tag, Typography } from 'antd';
import type { PaginatedMeta } from '../../../lib/api';

export function InvoiceHistoryHeader({ meta }: { meta?: PaginatedMeta; loading?: boolean }) {
  return <Flex align="center" justify="space-between" gap={16} wrap><span><Typography.Title level={1}>Historial de facturas</Typography.Title><Typography.Paragraph type="secondary">Consulta, reimpresión y acciones autorizadas sobre facturas emitidas.</Typography.Paragraph></span><Tag icon={<FileTextOutlined aria-hidden="true" />}>{meta?.total ?? 0} facturas</Tag></Flex>;
}
