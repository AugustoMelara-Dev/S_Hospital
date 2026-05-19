<?php

namespace App\Http\Controllers;

use App\Actions\Reports\CashSessionReportService;
use App\Actions\Reports\CategoryReportService;
use App\Actions\Reports\DailyReportService;
use App\Actions\Reports\DashboardReportService;
use App\Actions\Reports\ExcelReportService;
use App\Actions\Reports\IncomeReportService;
use App\Actions\Reports\OperationsReportService;
use App\Actions\Reports\ServiceSalesReportService;
use App\Http\Requests\Reports\DailyReportRequest;
use App\Http\Requests\Reports\DashboardReportRequest;
use App\Http\Requests\Reports\DateRangeReportRequest;
use App\Models\CashRegisterSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function dashboard(DashboardReportRequest $request, DashboardReportService $reports): JsonResponse
    {
        return response()->json([
            'data' => $reports->report(),
        ]);
    }

    public function daily(DailyReportRequest $request, DailyReportService $reports): JsonResponse
    {
        return response()->json([
            'data' => $reports->report($request->reportDate()),
        ]);
    }

    public function income(DateRangeReportRequest $request, IncomeReportService $reports): JsonResponse
    {
        return response()->json([
            'data' => $reports->report($this->scopedFilters($request)),
        ]);
    }

    public function categories(DateRangeReportRequest $request, CategoryReportService $reports): JsonResponse
    {
        return response()->json([
            'data' => $reports->report($this->scopedFilters($request)),
        ]);
    }

    public function services(DateRangeReportRequest $request, ServiceSalesReportService $reports): JsonResponse
    {
        return response()->json([
            'data' => $reports->report($this->scopedFilters($request)),
        ]);
    }

    public function operations(DateRangeReportRequest $request, OperationsReportService $reports): JsonResponse
    {
        return response()->json([
            'data' => $reports->report($this->scopedFilters($request), $request->user()->can('backups.view')),
        ]);
    }

    public function export(
        DateRangeReportRequest $request,
        IncomeReportService $incomeReports,
        CategoryReportService $categoryReports,
        ServiceSalesReportService $serviceReports,
        OperationsReportService $operationReports,
    ): StreamedResponse {
        $request->user()->can('reports.export') || abort(403);

        $filters = $this->scopedFilters($request);
        $income = $incomeReports->report($filters);
        $categories = $categoryReports->report($filters);
        $services = $serviceReports->report($filters);
        $operations = $operationReports->report($filters, $request->user()->can('backups.view'));

        $excelService = new ExcelReportService;
        $spreadsheet = $excelService->generate(
            $income,
            $categories,
            $services,
            $operations,
            Carbon::parse($request->dateFrom()),
            Carbon::parse($request->dateTo())
        );

        $writer = new Xlsx($spreadsheet);
        $writer->setIncludeCharts(true);
        $filename = sprintf(
            'reporte-hospital-%s-a-%s.xlsx',
            $request->dateFrom(),
            $request->dateTo()
        );

        return response()->streamDownload(function () use ($writer): void {
            $writer->save('php://output');
        }, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Cache-Control' => 'max-age=0',
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

    /**
     * @return array<string, mixed>
     */
    private function scopedFilters(DateRangeReportRequest $request): array
    {
        $filters = $request->validated();

        if ($request->user()->can('cash.close_any')) {
            return $filters;
        }

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

        return $filters;
    }
}
