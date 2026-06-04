<?php

declare(strict_types=1);

namespace App\Http\Requests\Billing;

use Illuminate\Foundation\Http\FormRequest;

class PatientSummaryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('invoices.view') === true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:1', 'max:200'],
        ];
    }

    public function patientName(): string
    {
        $name = (string) $this->validated('name');

        return trim($name);
    }
}
