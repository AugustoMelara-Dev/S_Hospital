<?php

namespace App\Http\Controllers;

use App\Actions\InstitutionalReceipts\InstitutionalReceiptPdfService;
use App\Actions\InstitutionalReceipts\ResolveReceiptPrintProfileAction;
use App\Http\Requests\InstitutionalReceipts\StoreReceiptSeriesRequest;
use App\Http\Requests\InstitutionalReceipts\TestReceiptPreviewRequest;
use App\Http\Requests\InstitutionalReceipts\UpdateReceiptInstitutionRequest;
use App\Http\Requests\InstitutionalReceipts\UpdateReceiptPrintProfileRequest;
use App\Http\Requests\InstitutionalReceipts\UpdateReceiptSeriesRequest;
use App\Http\Requests\InstitutionalReceipts\UpsertReceiptProfileAssignmentRequest;
use App\Http\Requests\InstitutionalReceipts\ViewReceiptSettingsRequest;
use App\Models\AuditLog;
use App\Models\FiscalSetting;
use App\Models\InstitutionalReceiptSeries;
use App\Models\ReceiptPrintProfile;
use App\Models\ReceiptProfileAssignment;
use App\Support\AuditLogger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

class InstitutionalReceiptSettingsController extends Controller
{
    private const SUPPORT_ONLY_PROFILE_CODES = [
        ReceiptPrintProfile::CODE_CUSTOM_SMALL,
        ReceiptPrintProfile::CODE_THERMAL_80,
        ReceiptPrintProfile::CODE_THERMAL_58,
    ];

    public function show(ViewReceiptSettingsRequest $request, ResolveReceiptPrintProfileAction $resolver): JsonResponse
    {
        try {
            $resolvedProfile = $resolver->execute($request->user());
        } catch (ValidationException) {
            $resolvedProfile = null;
        }

        $canViewAdvanced = $request->user()->can('receipt_settings.advanced');
        $printProfiles = $this->profilesQuery()->get();
        $assignments = ReceiptProfileAssignment::query()
            ->with('printProfile')
            ->orderBy('scope_type')
            ->orderBy('scope_id')
            ->orderByDesc('active')
            ->get();

        return response()->json([
            'data' => [
                'institution' => FiscalSetting::query()->first(),
                'active_series' => InstitutionalReceiptSeries::query()
                    ->where('document_type', InstitutionalReceiptSeries::DOCUMENT_TYPE)
                    ->where('active', true)
                    ->first(),
                'series' => $this->seriesQuery()->get(),
                'print_profiles' => $this->serializePrintProfiles($printProfiles, $canViewAdvanced),
                'assignments' => $this->serializeAssignments($assignments, $canViewAdvanced),
                'resolved_profile' => $this->serializePrintProfile($resolvedProfile, $canViewAdvanced),
            ],
        ]);
    }

    public function updateInstitution(UpdateReceiptInstitutionRequest $request): JsonResponse
    {
        $setting = DB::transaction(function () use ($request): FiscalSetting {
            $setting = FiscalSetting::query()->first() ?? new FiscalSetting;
            $fields = $this->institutionFields();
            $oldValues = $setting->exists ? $setting->only($fields) : null;

            if (! $setting->exists) {
                $setting->fill([
                    'default_tax_rate' => '15.00',
                    'receipt_width' => '80mm',
                    'primary_color' => 'indigo',
                    'receipt_paper_size' => 'half_letter',
                ]);
                $setting->created_by = $request->user()->id;
            }

            $values = $request->validated();
            $values['rtn'] = $values['rtn'] ?? '';

            $setting->fill([
                ...$values,
                'receipt_template_mode' => $request->input('receipt_template_mode', 'institutional'),
            ]);
            $setting->updated_by = $request->user()->id;
            $setting->save();

            $this->audit(
                $request->user()->id,
                $oldValues ? 'institutional_receipt.settings.updated' : 'institutional_receipt.settings.created',
                FiscalSetting::class,
                $setting->id,
                $oldValues,
                $setting->refresh()->only($fields)
            );

            return $setting->refresh();
        });

        return response()->json([
            'data' => $setting,
        ]);
    }

    public function series(ViewReceiptSettingsRequest $request): JsonResponse
    {
        return response()->json([
            'data' => $this->seriesQuery()->get(),
        ]);
    }

    public function storeSeries(StoreReceiptSeriesRequest $request): JsonResponse
    {
        $series = DB::transaction(function () use ($request): InstitutionalReceiptSeries {
            $series = InstitutionalReceiptSeries::query()->create([
                'document_type' => InstitutionalReceiptSeries::DOCUMENT_TYPE,
                'number_format' => '{series}-{number:08}',
                'receipt_number_color' => '#b91c1c',
                'reprint_behavior' => InstitutionalReceiptSeries::REPRINT_AUDIT_ONLY,
                'void_behavior' => InstitutionalReceiptSeries::VOID_PERMISSION_REASON_AUDIT,
                ...$request->validated(),
                'created_by' => $request->user()->id,
                'updated_by' => $request->user()->id,
            ]);

            $this->audit(
                $request->user()->id,
                'institutional_receipt_series.created',
                InstitutionalReceiptSeries::class,
                $series->id,
                null,
                $this->seriesAuditPayload($series)
            );

            return $series->refresh();
        });

        return response()->json([
            'data' => $series,
        ], 201);
    }

    public function updateSeries(UpdateReceiptSeriesRequest $request, InstitutionalReceiptSeries $series): JsonResponse
    {
        $series = DB::transaction(function () use ($request, $series): InstitutionalReceiptSeries {
            $oldValues = $this->seriesAuditPayload($series);

            $series->fill($request->validated());
            $series->updated_by = $request->user()->id;
            $series->save();

            $this->audit(
                $request->user()->id,
                'institutional_receipt_series.updated',
                InstitutionalReceiptSeries::class,
                $series->id,
                $oldValues,
                $this->seriesAuditPayload($series->refresh())
            );

            return $series->refresh();
        });

        return response()->json([
            'data' => $series,
        ]);
    }

    public function printProfiles(ViewReceiptSettingsRequest $request): JsonResponse
    {
        $canViewAdvanced = $request->user()->can('receipt_settings.advanced');

        return response()->json([
            'data' => $this->serializePrintProfiles($this->profilesQuery()->get(), $canViewAdvanced),
        ]);
    }

    public function updatePrintProfile(UpdateReceiptPrintProfileRequest $request, ReceiptPrintProfile $profile): JsonResponse
    {
        if ($request->hasAdvancedFields() && ! $request->user()->can('receipt_settings.advanced')) {
            AuditLogger::log(
                action: 'receipt_settings.advanced_denied',
                entity: $profile,
                request: $request,
                newValues: ['attempted_fields' => $request->advancedFieldsPresent()],
                reason: 'Intento de modificar campos avanzados sin permiso.',
                result: 'denied',
            );

            return response()->json([
                'message' => 'Este cambio requiere el permiso receipt_settings.advanced.',
                'errors' => [
                    'receipt_settings.advanced' => [
                        'No tiene permiso para modificar papel, orientacion, margenes, tamano, fuente, escala o campos tecnicos del recibo. Solicite soporte tecnico.',
                    ],
                ],
            ], 403);
        }

        $profile = DB::transaction(function () use ($request, $profile): ReceiptPrintProfile {
            $oldValues = $this->profileAuditPayload($profile);
            $values = $request->validated();
            $auditReason = $request->hasAdvancedFields() ? $request->supportReason() : null;
            unset($values['support_reason']);

            if (($values['is_global_default'] ?? false) === true) {
                ReceiptPrintProfile::query()
                    ->whereKeyNot($profile->id)
                    ->where('is_global_default', true)
                    ->get()
                    ->each(function (ReceiptPrintProfile $defaultProfile) use ($request, $auditReason): void {
                        $oldDefaultValues = $this->profileAuditPayload($defaultProfile);

                        $defaultProfile->is_global_default = false;
                        $defaultProfile->save();

                        $this->audit(
                            $request->user()->id,
                            'receipt_print_profile.updated',
                            ReceiptPrintProfile::class,
                            $defaultProfile->id,
                            $oldDefaultValues,
                            $this->profileAuditPayload($defaultProfile->refresh()),
                            $auditReason
                        );
                    });

                $values['active'] = true;
            }

            $profile->fill($values);
            $profile->save();

            $this->audit(
                $request->user()->id,
                'receipt_print_profile.updated',
                ReceiptPrintProfile::class,
                $profile->id,
                $oldValues,
                $this->profileAuditPayload($profile->refresh()),
                $auditReason
            );

            return $profile->refresh();
        });

        return response()->json([
            'data' => $profile,
        ]);
    }

    public function upsertAssignment(UpsertReceiptProfileAssignmentRequest $request): JsonResponse
    {
        $assignment = DB::transaction(function () use ($request): ReceiptProfileAssignment {
            $profile = $this->profileFromRequest($request->validated());
            $scopeType = (string) $request->input('scope_type');
            $scopeId = $scopeType === ReceiptProfileAssignment::SCOPE_GLOBAL ? null : (int) $request->input('scope_id');
            $active = $request->boolean('active', true);

            $existing = ReceiptProfileAssignment::query()
                ->with('printProfile')
                ->where('scope_type', $scopeType)
                ->when($scopeId === null, fn ($query) => $query->whereNull('scope_id'))
                ->when($scopeId !== null, fn ($query) => $query->where('scope_id', $scopeId))
                ->where('active', true)
                ->get();

            $existing->each(function (ReceiptProfileAssignment $item) use ($request): void {
                $oldAssignmentValues = $this->assignmentAuditPayload($item);

                $item->active = false;
                $item->updated_by = $request->user()->id;
                $item->save();

                $this->audit(
                    $request->user()->id,
                    'receipt_profile_assignment.deactivated',
                    ReceiptProfileAssignment::class,
                    $item->id,
                    $oldAssignmentValues,
                    $this->assignmentAuditPayload($item->refresh()->load('printProfile'))
                );
            });

            if (! $active && $existing->isNotEmpty()) {
                return $existing->last()->refresh()->load('printProfile');
            }

            $assignment = ReceiptProfileAssignment::query()->create([
                'receipt_print_profile_id' => $profile->id,
                'scope_type' => $scopeType,
                'scope_id' => $scopeId,
                'active' => $active,
                'created_by' => $request->user()->id,
                'updated_by' => $request->user()->id,
            ]);

            $this->audit(
                $request->user()->id,
                $existing->isEmpty() ? 'receipt_profile_assignment.created' : 'receipt_profile_assignment.replaced',
                ReceiptProfileAssignment::class,
                $assignment->id,
                $existing->map(fn (ReceiptProfileAssignment $item): array => $this->assignmentAuditPayload($item))->values()->all(),
                $this->assignmentAuditPayload($assignment->load('printProfile'))
            );

            return $assignment->load('printProfile');
        });

        return response()->json([
            'data' => $assignment,
        ]);
    }

    public function testPreview(TestReceiptPreviewRequest $request, ResolveReceiptPrintProfileAction $resolver): JsonResponse
    {
        $user = $request->user();
        $profile = $request->filled('profile_id') || $request->filled('profile_code')
            ? $this->profileFromRequest($request->validated())
            : $resolver->execute($user);

        $series = InstitutionalReceiptSeries::query()
            ->where('document_type', InstitutionalReceiptSeries::DOCUMENT_TYPE)
            ->where('active', true)
            ->first();

        $nextNumber = $series ? $series->current_number + 1 : null;

        $this->audit(
            $request->user()->id,
            'institutional_receipt.test_preview_requested',
            InstitutionalReceiptSeries::class,
            $series?->id,
            null,
            [
                'profile_code' => $profile->code,
                'next_receipt_number' => $nextNumber,
                'reserved_number' => false,
            ]
        );

        return response()->json([
            'data' => [
                'watermark' => 'PRUEBA - SIN VALIDEZ',
                'reserved_number' => false,
                'next_receipt_number' => $nextNumber,
                'profile' => $profile,
                'sample' => [
                    'payer_name' => $request->input('payer_name', 'Paciente de prueba'),
                    'concept' => $request->input('concept', 'Servicios hospitalarios de prueba'),
                    'amount' => $request->input('amount', '0.00'),
                ],
            ],
        ]);
    }

    public function testPrint(
        TestReceiptPreviewRequest $request,
        ResolveReceiptPrintProfileAction $resolver,
        InstitutionalReceiptPdfService $pdfService,
    ): Response {
        $user = $request->user();
        $profile = $request->filled('profile_id') || $request->filled('profile_code')
            ? $this->profileFromRequest($request->validated())
            : $resolver->execute($user);

        $series = InstitutionalReceiptSeries::query()
            ->where('document_type', InstitutionalReceiptSeries::DOCUMENT_TYPE)
            ->where('active', true)
            ->first();

        $pdf = $pdfService->pdfForDraft($request->validated(), $profile, $series);
        $pdfService->recordTestPrintEvent($profile, $user);

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="recibo-institucional-prueba.pdf"',
            'X-Receipt-Test-Print' => 'PRUEBA - SIN VALIDEZ',
        ]);
    }

    /**
     * @param  iterable<ReceiptPrintProfile>  $profiles
     * @return array<int, array<string, mixed>>
     */
    private function serializePrintProfiles(iterable $profiles, bool $canViewAdvanced): array
    {
        $payload = [];

        foreach ($profiles as $profile) {
            if (! $canViewAdvanced && $this->isSupportOnlyProfile($profile)) {
                continue;
            }

            $serialized = $this->serializePrintProfile($profile, $canViewAdvanced);
            if ($serialized !== null) {
                $payload[] = $serialized;
            }
        }

        return $payload;
    }

    /**
     * @param  iterable<ReceiptProfileAssignment>  $assignments
     * @return array<int, array<string, mixed>>
     */
    private function serializeAssignments(iterable $assignments, bool $canViewAdvanced): array
    {
        $payload = [];

        foreach ($assignments as $assignment) {
            $profile = $assignment->printProfile;
            if (! $canViewAdvanced && $profile instanceof ReceiptPrintProfile && $this->isSupportOnlyProfile($profile)) {
                continue;
            }

            if ($canViewAdvanced) {
                $payload[] = $assignment->toArray();

                continue;
            }

            $payload[] = [
                'id' => $assignment->id,
                'receipt_print_profile_id' => $assignment->receipt_print_profile_id,
                'profile_code' => $profile instanceof ReceiptPrintProfile ? $profile->code : null,
                'profile_name' => $profile instanceof ReceiptPrintProfile ? $profile->name : null,
                'scope_type' => $assignment->scope_type,
                'scope_id' => $assignment->scope_id,
                'active' => $assignment->active,
                'print_profile' => $profile instanceof ReceiptPrintProfile
                    ? $this->serializePrintProfile($profile, false)
                    : null,
            ];
        }

        return $payload;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function serializePrintProfile(?ReceiptPrintProfile $profile, bool $canViewAdvanced): ?array
    {
        if (! $profile instanceof ReceiptPrintProfile) {
            return null;
        }

        if ($canViewAdvanced) {
            return $profile->toArray();
        }

        if ($this->isSupportOnlyProfile($profile)) {
            return null;
        }

        return [
            'id' => $profile->id,
            'code' => $profile->code,
            'name' => $profile->name,
            'copies_mode' => $profile->copies_mode,
            'show_copy_legend' => $profile->show_copy_legend,
            'show_physical_seal_space' => $profile->show_physical_seal_space,
            'use_logo' => $profile->use_logo,
            'active' => $profile->active,
            'is_global_default' => $profile->is_global_default,
        ];
    }

    private function isSupportOnlyProfile(ReceiptPrintProfile $profile): bool
    {
        return in_array($profile->code, self::SUPPORT_ONLY_PROFILE_CODES, true);
    }

    /**
     * @return array<int, string>
     */
    private function institutionFields(): array
    {
        return [
            'hospital_name',
            'rtn',
            'address',
            'slogan',
            'government_line',
            'secretariat_line',
            'receipt_location',
            'receipt_footer_text',
            'receipt_template_mode',
        ];
    }

    private function seriesQuery(): Builder
    {
        return InstitutionalReceiptSeries::query()
            ->where('document_type', InstitutionalReceiptSeries::DOCUMENT_TYPE)
            ->orderByDesc('active')
            ->orderByDesc('id');
    }

    /**
     * @return Builder<ReceiptPrintProfile>
     */
    private function profilesQuery(): Builder
    {
        return ReceiptPrintProfile::query()
            ->orderByDesc('active')
            ->orderByDesc('is_global_default')
            ->orderBy('id');
    }

    /**
     * @param  array<string, mixed>  $values
     */
    private function profileFromRequest(array $values): ReceiptPrintProfile
    {
        if (isset($values['profile_id'])) {
            return ReceiptPrintProfile::query()->findOrFail($values['profile_id']);
        }

        return ReceiptPrintProfile::query()
            ->where('code', $values['profile_code'])
            ->firstOrFail();
    }

    /**
     * @return array<string, mixed>
     */
    private function seriesAuditPayload(InstitutionalReceiptSeries $series): array
    {
        return $series->only([
            'document_type',
            'series',
            'prefix',
            'number_format',
            'min_number',
            'max_number',
            'current_number',
            'range_authorization',
            'legal_text',
            'receipt_number_color',
            'active',
            'reprint_behavior',
            'void_behavior',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function profileAuditPayload(ReceiptPrintProfile $profile): array
    {
        return $profile->only([
            'code',
            'name',
            'paper_kind',
            'width_mm',
            'height_mm',
            'margin_top_mm',
            'margin_right_mm',
            'margin_bottom_mm',
            'margin_left_mm',
            'orientation',
            'template_code',
            'font_family',
            'font_scale',
            'copies_mode',
            'show_copy_legend',
            'show_physical_seal_space',
            'use_logo',
            'show_technical_fields',
            'active',
            'is_global_default',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function assignmentAuditPayload(ReceiptProfileAssignment $assignment): array
    {
        $profile = $assignment->printProfile;

        return [
            'id' => $assignment->id,
            'receipt_print_profile_id' => $assignment->receipt_print_profile_id,
            'profile_code' => $profile instanceof ReceiptPrintProfile ? $profile->code : null,
            'scope_type' => $assignment->scope_type,
            'scope_id' => $assignment->scope_id,
            'active' => $assignment->active,
        ];
    }

    /**
     * @param  array<string, mixed>|array<int, mixed>|null  $oldValues
     * @param  array<string, mixed>|array<int, mixed>|null  $newValues
     */
    private function audit(int $userId, string $action, string $entityType, ?int $entityId, ?array $oldValues, ?array $newValues, ?string $reason = null): void
    {
        AuditLog::query()->create([
            'user_id' => $userId,
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'reason' => $reason,
        ]);
    }
}
