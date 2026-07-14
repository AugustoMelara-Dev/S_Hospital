import { Card, Typography } from 'antd';
import { roleChecklists } from '../trainingContent';

const labels = {
  cajero: 'Cajero',
  supervisor: 'Supervisor',
  admin: 'Administrador',
};

export function RoleChecklist() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {Object.entries(roleChecklists).map(([role, items]) => (
        <Card key={role}>
          <Typography.Title level={2} className="text-base">{labels[role as keyof typeof labels]}</Typography.Title>
          <div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {items.map((item) => (
                <li key={item} className="border border-border p-3">{item}</li>
              ))}
            </ul>
          </div>
        </Card>
      ))}
    </div>
  );
}
