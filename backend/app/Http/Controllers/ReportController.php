<?php

namespace App\Http\Controllers;

use App\Actions\Reports\CashSessionReportService;
use App\Actions\Reports\CategoryReportService;
use App\Actions\Reports\DailyReportService;
use App\Actions\Reports\IncomeReportService;
use App\Actions\Reports\ServiceSalesReportService;
use App\Http\Requests\Reports\DailyReportRequest;
use App\Http\Requests\Reports\DateRangeReportRequest;
use App\Models\CashRegisterSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function daily(DailyReportRequest $request, DailyReportService $reports): JsonResponse
    {
        return response()->json([
            'data' => $reports->report($request->reportDate()),
        ]);
    }

    public function income(DateRangeReportRequest $request, IncomeReportService $reports): JsonResponse
    {
        $filters = $request->validated();

        if (! $request->user()->can('cash.close_any')) {
            if (
                ! empty($filters['cash_session_id'])
                && CashRegisterSession::query()
                    ->whereKey($filters['cash_session_id'])
                    ->where('user_id', $request->user()->id)
                    ->doesntExist()
            ) {
                abort(403);
            }

            $filters['user_id'] = $request->user()->id;
        }

        return response()->json([
            'data' => $reports->report($filters),
        ]);
    }

    public function categories(DateRangeReportRequest $request, CategoryReportService $reports): JsonResponse
    {
        return response()->json([
            'data' => $reports->report($request->dateFrom(), $request->dateTo()),
        ]);
    }

    public function services(DateRangeReportRequest $request, ServiceSalesReportService $reports): JsonResponse
    {
        return response()->json([
            'data' => $reports->report($request->dateFrom(), $request->dateTo()),
        ]);
    }

    public function cashSession(
        Request $request,
        CashRegisterSession $cashSession,
        CashSessionReportService $reports,
    ): JsonResponse {
        ($request->user()->can('reports.cash_session.view')
            || $request->user()->can('reports.managerial.view')) || abort(403);

        abort_unless(
            $request->user()->can('cash.close_any') || $cashSession->user_id === $request->user()->id,
            403,
        );

        return response()->json([
            'data' => $reports->report($cashSession),
        ]);
    }
}
