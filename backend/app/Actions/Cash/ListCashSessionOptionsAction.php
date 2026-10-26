<?php

namespace App\Actions\Cash;

use App\Models\CashRegister;
use App\Models\CashRegisterSession;
use App\Models\User;

class ListCashSessionOptionsAction
{
    /** @param array{kind: string, search?: string, page?: int|string, per_page?: int|string, selected_id?: int|string} $filters
     * @return array<string, mixed>
     */
    public function execute(User $user, array $filters): array
    {
        $visibleSessions = CashRegisterSession::query()
            ->when(! $user->canAny(['cash.close_any', 'reports.managerial.view']), fn ($query) => $query->where('user_id', $user->id));
        $kind = (string) $filters['kind'];
        $query = match ($kind) {
            'cashiers' => User::query()->select(['id', 'name'])->whereIn('id', (clone $visibleSessions)->select('user_id'))->orderBy('name')->orderBy('id'),
            'registers' => CashRegister::query()->select(['id', 'code', 'name'])->whereIn('id', (clone $visibleSessions)->select('cash_register_id'))->orderBy('name')->orderBy('id'),
            default => $visibleSessions->select(['id', 'user_id', 'cash_register_id', 'opened_at'])
                ->with(['user:id,name', 'cashRegister:id,code,name'])->orderByDesc('opened_at')->orderByDesc('id'),
        };
        $selected = isset($filters['selected_id'])
            ? (clone $query)->whereKey($filters['selected_id'])->first()
            : null;
        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            // Treat SQL wildcards as ordinary user text, not an unrestricted search.
            $pattern = '%'.addcslashes($search, '\\%_').'%';
            $query->where(function ($query) use ($kind, $pattern, $search): void {
                if ($kind !== 'sessions') {
                    $query->where('name', 'like', $pattern);
                    if ($kind === 'registers') {
                        $query->orWhere('code', 'like', $pattern);
                    }

                    return;
                }
                if (ctype_digit($search)) {
                    $query->whereKey((int) $search);

                    return;
                }
                $query->whereHas('user', fn ($users) => $users->where('name', 'like', $pattern))
                    ->orWhereHas('cashRegister', fn ($registers) => $registers->where('name', 'like', $pattern)->orWhere('code', 'like', $pattern));
                if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $search) === 1) {
                    $query->orWhereDate('opened_at', $search);
                }
            });
        }
        $page = $query->paginate((int) ($filters['per_page'] ?? 20));

        return [
            'data' => $page->getCollection()->map(fn ($row): array => $this->option($row))->all(),
            'meta' => ['current_page' => $page->currentPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
            'selected' => $selected ? $this->option($selected) : null,
        ];
    }

    /** @return array{value: string, label: string} */
    private function option(CashRegisterSession|User|CashRegister $row): array
    {
        $label = $row instanceof CashRegisterSession
            ? sprintf('%s · %s · %s · Turno %d', $row->cashRegister->name ?? 'Caja', $row->user->name ?? 'Cajero', $row->opened_at?->format('Y-m-d H:i') ?? '', $row->id)
            : $row->name;

        return ['value' => (string) $row->id, 'label' => $label];
    }
}
