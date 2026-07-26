<?php

namespace App\Actions\Catalog;

use App\Models\Service;

class AuditInstitutionalServiceRulesAction
{
    public const CANONICAL_SOURCE_KEY = 'csv:service:medicamentos:eritropoyetina';

    /**
     * @return array{
     *     valid: bool,
     *     canonical_service_id: int|null,
     *     unexpected_service_ids: list<int>
     * }
     */
    public function execute(): array
    {
        $canonical = Service::query()
            ->where('source_key', self::CANONICAL_SOURCE_KEY)
            ->first();

        $ruledServices = Service::query()
            ->where('special_rule_code', Service::ERYTHROPOIETIN_RULE);

        if ($canonical !== null) {
            $ruledServices->whereKeyNot($canonical->getKey());
        }

        $unexpectedServiceIds = [];
        foreach ($ruledServices->orderBy('id')->cursor() as $service) {
            $unexpectedServiceIds[] = $service->id;
        }

        $canonicalIsValid = $canonical !== null
            && $canonical->special_rule_code === Service::ERYTHROPOIETIN_RULE
            && (string) $canonical->price === '25.00'
            && $canonical->taxable === false;

        return [
            'valid' => $canonicalIsValid && $unexpectedServiceIds === [],
            'canonical_service_id' => $canonical?->id,
            'unexpected_service_ids' => $unexpectedServiceIds,
        ];
    }
}
