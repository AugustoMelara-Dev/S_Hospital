import { Card, Typography } from 'antd';
import { supportPlaybooks } from '../trainingContent';

export function SupportPlaybookList() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {supportPlaybooks.map((playbook) => {
        const Icon = playbook.icon;

        return (
          <Card key={playbook.title}>
            <div className="mb-4">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center bg-accent text-secondary">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <Typography.Title level={2} className="text-base">{playbook.title}</Typography.Title>
              </div>
            </div>
            <div>
              <ol className="space-y-2 text-sm text-muted-foreground">
                {playbook.steps.map((step, index) => (
                  <li key={step} className="flex gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center bg-muted text-xs font-bold text-foreground">{index + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
