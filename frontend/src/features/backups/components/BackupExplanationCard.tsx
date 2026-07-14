import { DatabaseOutlined as Archive } from '@ant-design/icons';
import { Button, Card, Empty } from 'antd';

export function BackupEmptyState({
  onCreate,
  canCreate,
}: {
  onCreate?: () => void;
  canCreate: boolean;
}) {
  return (
    <Card className="border-operational-border bg-operational-surface">
      <Empty image={<Archive aria-hidden="true" className="text-4xl" />} description={<><h3 className="mb-2 text-lg font-semibold">No hay respaldos</h3><p className="mb-4 text-center text-muted-foreground">
          {canCreate
            ? 'Todavia no se ha creado ningun respaldo. Cree el primero para proteger los datos del hospital.'
            : 'Todavia no se ha creado ningun respaldo. Pida a un administrador autorizado crear el primero.'}
        </p></>}
      >
        {canCreate && onCreate && (
          <Button type="primary" size="small" icon={<Archive aria-hidden="true" />} onClick={onCreate}>Crear respaldo</Button>
        )}
      </Empty>
    </Card>
  );
}
