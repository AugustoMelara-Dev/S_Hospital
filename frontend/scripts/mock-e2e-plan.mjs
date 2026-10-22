export function buildMockE2eRuns() {
  return [
    {
      label: 'cobrar',
      args: [
        'test',
        'e2e/cobrar-flow.spec.ts',
        '--project=chromium',
      ],
    },
    {
      label: 'recibos-caja',
      args: [
        'test',
        'e2e/recibos-flow.spec.ts',
        'e2e/caja-flow.spec.ts',
        '--project=chromium',
      ],
    },
    {
      label: 'reportes-rbac',
      args: [
        'test',
        'e2e/reportes-flow.spec.ts',
        'e2e/rbac-admin.spec.ts',
        '--project=chromium',
      ],
    },
  ];
}
