import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supportPlaybooks } from '../trainingContent';

export function SupportPlaybookList() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {supportPlaybooks.map((playbook) => {
        const Icon = playbook.icon;

        return (
          <Card key={playbook.title}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center bg-accent text-secondary">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <CardTitle><h2>{playbook.title}</h2></CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-2 text-sm text-muted-foreground">
                {playbook.steps.map((step, index) => (
                  <li key={step} className="flex gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center bg-muted text-xs font-bold text-foreground">{index + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
