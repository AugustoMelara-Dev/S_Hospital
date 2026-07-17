<?php

namespace App\Http\Requests\Reports\Concerns;

use App\Models\CashRegisterSession;
use Illuminate\Support\Carbon;
use Throwable;

trait BuildsValidatedReportFilters
{
    /**
     * @return array{date_from: string, date_to: string, cash_session_id?: int|string, user_id?: int|string, category_id?: int|string, area_id?: int|string, method?: string, status?: string}
     */
    protected function validatedReportFilters(): array
    {
        $validated = $this->validated();
        $filters = [
            'date_from' => $this->string('date_from')->toString(),
            'date_to' => $this->string('date_to')->toString(),
        ];

        if (array_key_exists('cash_session_id', $validated)) {
            $cashSessionId = $validated['cash_session_id'];
            if (is_int($cashSessionId) || is_string($cashSessionId)) {
                $filters['cash_session_id'] = $cashSessionId;
            }
        }
        if (array_key_exists('user_id', $validated)) {
            $userId = $validated['user_id'];
            if (is_int($userId) || is_string($userId)) {
                $filters['user_id'] = $userId;
            }
        }
        if (array_key_exists('category_id', $validated)) {
            $categoryId = $validated['category_id'];
            if (is_int($categoryId) || is_string($categoryId)) {
                $filters['category_id'] = $categoryId;
            }
        }
        if (array_key_exists('area_id', $validated)) {
            $areaId = $validated['area_id'];
            if (is_int($areaId) || is_string($areaId)) {
                $filters['area_id'] = $areaId;
            }
        }
        if (array_key_exists('method', $validated)) {
            $filters['method'] = $this->string('method')->toString();
        }
        if (array_key_exists('status', $validated)) {
            $filters['status'] = $this->string('status')->toString();
        }

        return $filters;
    }

    protected function maximumDateTo(mixed $rawDateFrom, int $maxRangeDays): string
    {
        $fallback = fn (): string => Carbon::now()->addDays($maxRangeDays - 1)->toDateString();

        if (! is_string($rawDateFrom) || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $rawDateFrom)) {
            return $fallback();
        }

        try {
            $dateFrom = Carbon::createFromFormat('Y-m-d', $rawDateFrom);
        } catch (Throwable) {
            return $fallback();
        }

        if ($dateFrom === null || $dateFrom->format('Y-m-d') !== $rawDateFrom) {
            return $fallback();
        }

        return $dateFrom->copy()->addDays($maxRangeDays - 1)->toDateString();
    }

    /**
     * @param  array{date_from: string, date_to: string, cash_session_id?: int|string, user_id?: int|string, category_id?: int|string, area_id?: int|string, method?: string, status?: string}  $filters
     * @return array{date_from: string, date_to: string, cash_session_id?: int|string, user_id?: int|string, category_id?: int|string, area_id?: int|string, method?: string, status?: string}
     */
    protected function normalizeCashSessionDateRange(array $filters): array
    {
        if (empty($filters['cash_session_id'])) {
            return $filters;
        }

        $cashSession = CashRegisterSession::query()->findOrFail($filters['cash_session_id']);
        $openedAt = $cashSession->opened_at;

        if ($openedAt === null) {
            abort(422, 'La sesion de caja no tiene una fecha de apertura valida.');
        }

        $openedDate = $openedAt->toDateString();
        $closedDate = $cashSession->closed_at?->toDateString();

        $filters['date_from'] = $openedDate;
        $filters['date_to'] = $closedDate ?? $openedDate;

        return $filters;
    }
}
