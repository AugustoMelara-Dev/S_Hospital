import type { QueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';

export async function invalidateCatalogQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.categories.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.services.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.system.setupStatus() }),
  ]);
}

export async function invalidateBillingQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.cashSessions.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.reports.dashboard() }),
  ]);
}

export async function invalidateSettingsQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.settings.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.fiscalSequences.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.system.all }),
  ]);
}

export async function invalidateBackupQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.backups.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.system.all }),
  ]);
}
