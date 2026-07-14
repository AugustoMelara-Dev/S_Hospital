const shellGrep = [
  'institutional shell reports',
  'all supported branding',
  'real shell overlays',
  'mobile navigation',
].join('|');

export function buildMockE2eRuns() {
  return [
    {
      label: 'shell',
      args: [
        'test',
        'e2e/accessibility.spec.ts',
        '--project=chromium',
        '--grep',
        shellGrep,
      ],
    },
    {
      label: 'billing-catalog-admin',
      args: [
        'test',
        'e2e/new-invoice-flow.spec.ts',
        'e2e/invoice-history-flow.spec.ts',
        'e2e/catalog-flow.spec.ts',
        'e2e/users-flow.spec.ts',
        '--project=chromium',
      ],
    },
    {
      label: 'receipts-reports',
      args: [
        'test',
        'e2e/print-profiles.spec.ts',
        'e2e/reports-flow.spec.ts',
        'e2e/backups-flow.spec.ts',
        '--project=chromium',
      ],
    },
  ];
}
