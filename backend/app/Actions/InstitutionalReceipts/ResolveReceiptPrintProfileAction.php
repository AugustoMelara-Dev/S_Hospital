<?php

namespace App\Actions\InstitutionalReceipts;

use App\Models\CashRegisterSession;
use App\Models\ReceiptPrintProfile;
use App\Models\ReceiptProfileAssignment;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class ResolveReceiptPrintProfileAction
{
    public function execute(?User $user = null, ?CashRegisterSession $cashSession = null): ReceiptPrintProfile
    {
        $assignedProfile = $this->assignedProfile($user, $cashSession);

        if ($assignedProfile instanceof ReceiptPrintProfile) {
            return $assignedProfile;
        }

        $default = ReceiptPrintProfile::query()
            ->where('active', true)
            ->where('is_global_default', true)
            ->whereNotIn('paper_kind', ['thermal_80mm', 'thermal_58mm'])
            ->orderBy('id')
            ->first();

        if ($default instanceof ReceiptPrintProfile) {
            return $default;
        }

        $fallback = ReceiptPrintProfile::query()
            ->where('active', true)
            ->whereNotIn('paper_kind', ['thermal_80mm', 'thermal_58mm'])
            ->orderBy('id')
            ->first();

        if ($fallback instanceof ReceiptPrintProfile) {
            return $fallback;
        }

        throw ValidationException::withMessages([
            'print_profile' => 'No hay un perfil de impresion institucional activo disponible.',
        ]);
    }

    private function assignedProfile(?User $user, ?CashRegisterSession $cashSession): ?ReceiptPrintProfile
    {
        $scopes = [];

        if ($cashSession !== null) {
            $scopes[] = [ReceiptProfileAssignment::SCOPE_CASH_SESSION, $cashSession->id];
        }

        if ($user !== null) {
            $scopes[] = [ReceiptProfileAssignment::SCOPE_USER, $user->id];
        }

        $scopes[] = [ReceiptProfileAssignment::SCOPE_GLOBAL, null];

        foreach ($scopes as [$scopeType, $scopeId]) {
            $assignment = ReceiptProfileAssignment::query()
                ->with('printProfile')
                ->where('scope_type', $scopeType)
                ->when($scopeId === null, fn ($query) => $query->whereNull('scope_id'))
                ->when($scopeId !== null, fn ($query) => $query->where('scope_id', $scopeId))
                ->where('active', true)
                ->whereHas('printProfile', fn ($query) => $query->where('active', true))
                ->latest('id')
                ->first();

            if ($assignment?->printProfile instanceof ReceiptPrintProfile) {
                return $assignment->printProfile;
            }
        }

        return null;
    }
}
