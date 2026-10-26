import { useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { cash } from '@/lib/api';
import type { CashOption, CashOptionKind } from '@/lib/api/cash';
import { queryKeys } from '@/lib/queryKeys';
import { useDebouncedValue } from './useDebouncedValue';

/** Fetch only requested pages. The server resolves the authorized selection
 * separately, so old turns and cashiers remain usable after searching. */
export function useCashSessionOptions(kind: CashOptionKind, { enabled, selectedId }: { enabled: boolean; selectedId?: number }) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 250);
  const query = useInfiniteQuery({
    queryKey: [...queryKeys.cashSessions.all, 'options', kind, debouncedSearch, selectedId],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => cash.getCashSessionOptions({ kind, search: debouncedSearch, selectedId, page: pageParam }),
    getNextPageParam: (last) => last.meta.current_page * last.meta.per_page < last.meta.total ? last.meta.current_page + 1 : undefined,
    enabled,
    staleTime: 60_000,
  });
  const options = useMemo(() => {
    const entries = new Map<string, CashOption>();
    for (const page of query.data?.pages ?? []) {
      for (const option of page.data) entries.set(option.value, option);
      if (page.selected) entries.set(page.selected.value, page.selected);
    }
    return [...entries.values()];
  }, [query.data]);
  return { ...query, options, search, setSearch, searching: search.trim() !== debouncedSearch };
}
