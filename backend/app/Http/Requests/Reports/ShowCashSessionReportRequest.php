<?php

namespace App\Http\Requests\Reports;

use App\Models\CashRegisterSession;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class ShowCashSessionReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        if (
            ! $user instanceof User
            || (! $user->can('reports.cash_session.view') && ! $user->can('reports.managerial.view'))
        ) {
            return false;
        }

        $cashSession = $this->route('cashSession');

        if (! $cashSession instanceof CashRegisterSession) {
            return false;
        }

        return $user->can('reports.managerial.view')
            || $cashSession->user_id === $user->id;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [];
    }
}
