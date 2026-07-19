import { Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

export function BackupEmptyState({ onCreate, canCreate }: { onCreate?: () => void; canCreate: boolean }) {
  return (
    <Card>
      <CardContent>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Database aria-hidden="true" /></EmptyMedia>
            <EmptyTitle>No hay respaldos</EmptyTitle>
            <EmptyDescription>{canCreate ? 'Todavía no se ha creado ningún respaldo. Cree el primero para proteger los datos del hospital.' : 'Todavía no se ha creado ningún respaldo. Pida a un administrador autorizado crear el primero.'}</EmptyDescription>
          </EmptyHeader>
          {canCreate && onCreate ? <EmptyContent><Button size="sm" onClick={onCreate}><Database data-icon="inline-start" />Crear respaldo</Button></EmptyContent> : null}
        </Empty>
      </CardContent>
    </Card>
  );
}
