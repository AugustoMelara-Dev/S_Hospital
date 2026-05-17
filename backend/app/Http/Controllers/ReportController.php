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
use Symfony\Component\HttpFoundation\StreamedResponse;

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

    public function export(
        DateRangeReportRequest $request,
        IncomeReportService $incomeReports,
        CategoryReportService $categoryReports,
        ServiceSalesReportService $serviceReports,
    ): StreamedResponse {
        $request->user()->can('reports.export') || abort(403);

        $income = $incomeReports->report($request->validated());
        $categories = $categoryReports->report($request->dateFrom(), $request->dateTo());
        $services = $serviceReports->report($request->dateFrom(), $request->dateTo());
        $filename = sprintf('reporte-hospital-%s-a-%s.csv', $request->dateFrom(), $request->dateTo());

        return response()->streamDownload(function () use ($income, $categories, $services): void {
            $output = fopen('php://output', 'w');

            if ($output === false) {
                return;
            }

            fputcsv($output, ['seccion', 'nombre', 'categoria', 'cantidad', 'total']);
            fputcsv($output, ['ingresos', 'Total cobrado', '', '', $income['total_collected']]);

            foreach ($income['payments_by_method'] as $method => $total) {
                fputcsv($output, ['metodo_pago', $method, '', '', $total]);
            }

            foreach ($categories['categories'] as $category) {
                fputcsv($output, [
                    'categoria',
                    $category['category'],
                    $category['category'],
                    $category['quantity'],
                    $category['total'],
                ]);
            }

            foreach ($services['services'] as $service) {
                fputcsv($output, [
                    'servicio',
                    $service['service'],
                    $service['category'],
                    $service['quantity'],
                    $service['total'],
                ]);
            }
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
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
