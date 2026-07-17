<?php

namespace App\Http\Requests\Cash;

use Illuminate\Foundation\Http\FormRequest;

class CloseCashSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('cash.close') === true
            || $this->user()?->can('cash.close_any') === true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $rules = [
            'closing_amount' => ['required', 'decimal:0,2', 'min:0'],
            'notes' => ['nullable', 'string', 'max:255'],
            'closing_breakdown' => ['sometimes', 'array:bills,other_amount'],
            'closing_breakdown.bills' => ['required_with:closing_breakdown', 'array:500,200,100,50,20,10,5,2,1'],
            'closing_breakdown.other_amount' => ['required_with:closing_breakdown', 'decimal:0,2', 'min:0'],
        ];

        foreach ([500, 200, 100, 50, 20, 10, 5, 2, 1] as $denomination) {
            $rules["closing_breakdown.bills.{$denomination}"] = ['sometimes', 'integer', 'min:0', 'max:99999'];
        }

        return $rules;
    }

    /** @return array{closing_amount: string, notes?: string|null, closing_breakdown?: array{bills: array<int, int>, other_amount: string}} */
    public function payload(): array
    {
        $payload = [
            'closing_amount' => $this->string('closing_amount')->toString(),
        ];

        if ($this->exists('notes')) {
            $payload['notes'] = $this->input('notes') === null
                ? null
                : $this->string('notes')->toString();
        }

        if ($this->has('closing_breakdown')) {
            $bills = [];

            foreach ([500, 200, 100, 50, 20, 10, 5, 2, 1] as $denomination) {
                if ($this->exists("closing_breakdown.bills.{$denomination}")) {
                    $bills[$denomination] = $this->integer("closing_breakdown.bills.{$denomination}");
                }
            }

            $payload['closing_breakdown'] = [
                'bills' => $bills,
                'other_amount' => $this->string('closing_breakdown.other_amount')->toString(),
            ];
        }

        return $payload;
    }
}
