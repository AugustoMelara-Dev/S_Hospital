<?php

declare(strict_types=1);

namespace App\Http\Requests\Reports;

use App\Models\CashRegisterSession;
use Illuminate\Foundation\Http\FormRequest;

class ShowCashSessionReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        if (
            $this->user()?->can('reports.cash_session.view') !== true
            && $this->user()?->can('reports.managerial.view') !== true
        ) {
            return false;
        }

        $cashSession = $this->route('cashSession');

        if (! $cashSession instanceof CashRegisterSession) {
            return false;
        }

        return $this->user()?->can('cash.close_any') === true
            || $cashSession->user_id === $this->user()?->id;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [];
    }
}
