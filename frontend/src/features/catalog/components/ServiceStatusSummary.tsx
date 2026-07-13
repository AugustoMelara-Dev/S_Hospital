import { PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Flex, Space, Typography } from 'antd';
import type { ServiceStatusSummaryProps } from './catalogTypes';

export function ServiceStatusSummary({ canManage, onNewCategory, onNewService, summary }: ServiceStatusSummaryProps) {
  const totalLabel = `${summary.total} servicio${summary.total !== 1 ? 's' : ''} en el catálogo`;
  return (
    <header className="border-b border-slate-300 pb-4">
      <Typography.Text>Servicios y productos facturables</Typography.Text>
      <Typography.Title id="catalog-title" level={1}>Catálogo institucional</Typography.Title>
      <Typography.Paragraph>{canManage ? 'Administre categorías, servicios y precios para mantener operativo el catálogo de caja.' : 'Cajero puede consultar catálogo y precios, sin permisos para modificar servicios.'}</Typography.Paragraph>
      <Flex justify="space-between" align="center" wrap>
        <Typography.Text aria-label="Resumen de servicios en el catálogo">{totalLabel}</Typography.Text>
        {canManage ? <Space wrap><Button onClick={onNewCategory} aria-label="Crear nueva categoría" icon={<PlusOutlined />}>Nueva categoría</Button><Button type="primary" onClick={onNewService} aria-label="Crear nuevo servicio" icon={<PlusOutlined />}>Nuevo servicio</Button></Space> : <Alert type="info" title="Solo lectura" description="Esta cuenta puede consultar el catálogo, pero no modificar servicios ni categorías." />}
      </Flex>
    </header>
  );
}
