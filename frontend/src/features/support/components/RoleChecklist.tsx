import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
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
          <CardHeader>
            <CardTitle className="text-base">{labels[role as keyof typeof labels]}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {items.map((item) => (
                <li key={item} className="rounded-md border border-border bg-muted/30 p-2">{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
