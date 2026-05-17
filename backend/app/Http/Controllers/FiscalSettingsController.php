<?php

namespace App\Http\Controllers;

use App\Http\Requests\Fiscal\UpdateFiscalSettingsRequest;
use App\Models\FiscalSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FiscalSettingsController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $request->user()->can('settings.fiscal.view') || abort(403);

        return response()->json([
            'data' => FiscalSetting::query()->first(),
        ]);
    }

    public function update(UpdateFiscalSettingsRequest $request): JsonResponse
    {
        $setting = FiscalSetting::query()->firstOrNew(['id' => 1]);
        $setting->fill($request->validated());

        if (! $setting->exists) {
            $setting->created_by = $request->user()->id;
        }

        $setting->updated_by = $request->user()->id;
        $setting->save();

        return response()->json([
            'data' => $setting->refresh(),
        ]);
    }
}
