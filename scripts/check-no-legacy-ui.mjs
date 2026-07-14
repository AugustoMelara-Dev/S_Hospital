import { readFileSync } from 'node:fs';

const cleanFiles = [
  'frontend/src/App.tsx', 'frontend/src/AppRoutes.tsx',
  'frontend/src/components/AppErrorBoundary.tsx', 'frontend/src/components/PermissionGate.tsx',
  'frontend/src/design-system/patterns/RouteState.tsx',
  'frontend/src/design-system/providers/DesignSystemProvider.tsx',
  'frontend/src/design-system/providers/FeedbackProvider.tsx',
  'frontend/src/layout/components/AppBreadcrumbs.tsx', 'frontend/src/layout/components/UserMenu.tsx',
  'frontend/src/shell/InstitutionalShell.tsx', 'frontend/src/shell/navigation/CommandPalette.tsx',
  'frontend/src/shell/navigation/InstitutionalMobileNav.tsx',
  'frontend/src/shell/navigation/InstitutionalRail.tsx', 'frontend/src/shell/status/ContextBar.tsx',
];
const forbidden = [
  [/components\/ui\/(?:dialog|states|breadcrumb)/, 'overlay/state/breadcrumb legacy'],
  [/Clinical(?:Shell|Rail|MobileNav|Toaster)/, 'terminologia Clinical'],
  [/MotionProvider|design-system\/primitives\/Toaster/, 'provider legacy'],
  [/\b(?:rounded-(?!none)|shadow(?:-|\b)|bg-gradient-)\S*/, 'geometria decorativa legacy'],
];
const errors = [];
for (const file of cleanFiles) {
  const source = readFileSync(file, 'utf8');
  for (const [pattern, label] of forbidden) if (pattern.test(source)) errors.push(`${file}: ${label}`);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Legacy UI check passed for ${cleanFiles.length} files.`);
