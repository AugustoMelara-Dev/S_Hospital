<?php

namespace App\Http\Controllers;

use App\Http\Requests\Cash\IndexCashRegisterRequest;
use App\Models\CashRegister;
use Illuminate\Http\JsonResponse;

class CashRegisterController extends Controller
{
    public function index(IndexCashRegisterRequest $request): JsonResponse
    {
        $registers = CashRegister::query()
            ->where('active', true)
            ->orderBy('name')
            ->orderBy('code')
            ->get(['id', 'code', 'name', 'active'])
            ->map(fn (CashRegister $register): array => [
                'id' => (int) $register->id,
                'code' => (string) $register->code,
                'name' => (string) $register->name,
                'active' => (bool) $register->active,
            ])
            ->values();

        return response()->json(['data' => $registers]);
    }
}
