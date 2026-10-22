<?php

namespace App\Actions\Billing;

use App\Models\Service;
use Illuminate\Validation\ValidationException;

/**
 * Validates and resolves the draft lines of an invoice (emission or preview)
 * into the shape expected by CalculateInvoiceTotalsAction.
 *
 * Extracted from CreateInvoiceAction so the prevalidation endpoint validates
 * exactly the same services (exists / active / category active / visible in
 * billing / billable) the emission path does. A service the preview accepts
 * must be a service the emission accepts.
 */
class PrepareInvoiceItemsAction
{
    /**
     * @param  list<array{service_id: int, quantity: string, notes?: ?string}>  $items
     * @return list<array{service: Service, quantity: string, notes: ?string}>
     */
    public function execute(array $items): array
    {
        $serviceIds = collect($items)->pluck('service_id')->unique()->values();
        $services = Service::query()
            ->with([
                'category:id,name,active',
                'area:id,name,slug',
                'taxRate:id,name,percentage,active',
            ])
            ->whereIn('id', $serviceIds)
            ->get()
            ->keyBy('id');

        $prepared = [];

        foreach ($items as $index => $item) {
            /** @var Service|null $service */
            $service = $services->get($item['service_id']);
            $field = "items.{$index}.service_id";

            if ($service === null) {
                throw ValidationException::withMessages([
                    $field => 'El servicio seleccionado no existe.',
                ]);
            }

            if (! $service->active) {
                throw ValidationException::withMessages([
                    $field => 'El servicio seleccionado esta inactivo.',
                ]);
            }

            if (! $service->category?->active) {
                throw ValidationException::withMessages([
                    $field => 'La categoria del servicio seleccionado esta inactiva.',
                ]);
            }

            if (! $service->visible_in_billing) {
                throw ValidationException::withMessages([
                    $field => 'El servicio seleccionado no esta visible para facturacion.',
                ]);
            }

            if (! $service->is_billable) {
                throw ValidationException::withMessages([
                    $field => 'El servicio seleccionado no es facturable.',
                ]);
            }

            $prepared[] = [
                'service' => $service,
                'quantity' => $item['quantity'],
                'notes' => $this->normalizeItemNotes($item['notes'] ?? null),
            ];
        }

        return $prepared;
    }

    private function normalizeItemNotes(mixed $notes): ?string
    {
        if (! is_string($notes)) {
            return null;
        }

        $normalized = trim($notes);

        return $normalized === '' ? null : $normalized;
    }
}
