<?php

namespace App\Http\Requests\Cash;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;

/**
 * M-W2-FIN-02/FIN-03 (mandato §7): consulta de conciliacion consolidada por caja.
 *
 * Es una vista gerencial (agrega varias cajas) por lo que exige
 * `reports.managerial.view`, igual que el reporte de cierre por sesion. El
 * rango de fechas es obligatorio y acotado (31 dias) para no inventar una
 * ventana por defecto.
 *
 * El rango se interpreta como dia operativo en la zona del hospital
 * (`config('app.timezone')`, America/Tegucigalpa): incluye las sesiones de caja
 * cuyo `opened_at` **o** `closed_at` cae entre `date_from 00:00:00` y
 * `date_to 23:59:59` (mismo criterio que `ExecutiveReportService::cashSessions`).
 */
class ConsolidatedCashSessionRequest extends FormRequest
{
    public const MAX_RANGE_DAYS = 31;

    public function authorize(): bool
    {
        return $this->user()?->can('reports.managerial.view') === true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'date_from' => ['required', 'date_format:Y-m-d'],
            'date_to' => [
                'required',
                'date_format:Y-m-d',
                'after_or_equal:date_from',
                'before_or_equal:'.$this->maxDateTo(),
            ],
            'cash_register_id' => ['sometimes', 'integer', 'exists:cash_registers,id'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'date_to.before_or_equal' => 'El rango maximo permitido para reportes es de '.self::MAX_RANGE_DAYS.' dias.',
        ];
    }

    public function dateFrom(): string
    {
        return $this->string('date_from')->toString();
    }

    public function dateTo(): string
    {
        return $this->string('date_to')->toString();
    }

    private function maxDateTo(): string
    {
        $rawDateFrom = $this->input('date_from');

        if (! is_string($rawDateFrom) || preg_match('/^\d{4}-\d{2}-\d{2}$/', $rawDateFrom) !== 1) {
            return Carbon::now()->addDays(self::MAX_RANGE_DAYS - 1)->toDateString();
        }

        return Carbon::parse($rawDateFrom)->addDays(self::MAX_RANGE_DAYS - 1)->toDateString();
    }
}
