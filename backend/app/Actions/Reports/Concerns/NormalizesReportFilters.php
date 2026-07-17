<?php

namespace App\Actions\Reports\Concerns;

trait NormalizesReportFilters
{
    /**
     * @param  array{date_from: string, date_to: string, cash_session_id?: int|string, user_id?: int|string, category_id?: int|string, area_id?: int|string, method?: string, status?: string}  $filters
     * @return array{date_from: string, date_to: string, cash_session_id: int|string|null, user_id: int|string|null, category_id: int|string|null, area_id: int|string|null, method: string|null, status: string|null}
     */
    protected function normalizeReportFilters(array $filters): array
    {
        return [
            'date_from' => $filters['date_from'],
            'date_to' => $filters['date_to'],
            'cash_session_id' => $filters['cash_session_id'] ?? null,
            'user_id' => $filters['user_id'] ?? null,
            'category_id' => $filters['category_id'] ?? null,
            'area_id' => $filters['area_id'] ?? null,
            'method' => $filters['method'] ?? null,
            'status' => $filters['status'] ?? null,
        ];
    }
}
