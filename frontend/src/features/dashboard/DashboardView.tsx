import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';

type DashboardViewProps = {
  canCreateInvoices: boolean;
  canViewBackups: boolean;
  canViewCash: boolean;
  canViewCatalog: boolean;
  canViewFiscalSettings: boolean;
  canViewInvoices: boolean;
  canViewReports: boolean;
};

export function DashboardView({
  canCreateInvoices,
  canViewBackups,
  canViewCash,
  canViewCatalog,
  canViewFiscalSettings,
  canViewInvoices,
  canViewReports,
}: DashboardViewProps) {
  const modules = [
    { label: 'Nueva factura', enabled: canCreateInvoices },
    { label: 'Caja', enabled: canViewCash },
    { label: 'Catalogo', enabled: canViewCatalog },
    { label: 'Historial', enabled: canViewInvoices },
    { label: 'Reportes', enabled: canViewReports },
    { label: 'Backups', enabled: canViewBackups },
    { label: 'Configuracion fiscal', enabled: canViewFiscalSettings },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Resumen de modulos disponibles. Use la navegacion lateral para operar una pantalla a la vez."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {modules.map((module) => (
          <Card key={module.label}>
            <CardHeader>
              <CardTitle>{module.label}</CardTitle>
              <CardDescription>
                {module.enabled ? 'Disponible para este usuario.' : 'Oculto por permisos.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant={module.enabled ? 'default' : 'secondary'}>
                {module.enabled ? 'Activo' : 'Sin permiso'}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
