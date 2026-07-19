import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
          <CardHeader><CardTitle><h2>{labels[role as keyof typeof labels]}</h2></CardTitle></CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              {items.map((item) => (
                <li key={item} className="border border-border p-3">{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
