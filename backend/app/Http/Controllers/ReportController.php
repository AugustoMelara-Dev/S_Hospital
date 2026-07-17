<?php

namespace App\Http\Controllers;

use App\Actions\Reports\AreaIncomeReportService;
use App\Actions\Reports\CashSessionReportService;
use App\Actions\Reports\CategoryReportService;
use App\Actions\Reports\DailyReportService;
use App\Actions\Reports\DashboardReportService;
use App\Actions\Reports\ExecutiveExcelExportService;
use App\Actions\Reports\ExecutivePdfExportService;
use App\Actions\Reports\ExecutiveReportService;
use App\Actions\Reports\IncomeReportService;
use App\Actions\Reports\MonthlyReportService;
use App\Actions\Reports\OperationsReportService;
use App\Actions\Reports\PdfExportService;
use App\Actions\Reports\PremiumExcelExportService;
use App\Actions\Reports\ServiceSalesReportService;
use App\Actions\Reports\TodayReportService;
use App\Http\Requests\Reports\DailyReportRequest;
use App\Http\Requests\Reports\DashboardReportRequest;
use App\Http\Requests\Reports\DateRangeReportRequest;
use App\Http\Requests\Reports\ExecutivePdfExportRequest;
use App\Http\Requests\Reports\ExecutiveReportRequest;
use App\Http\Requests\Reports\ExportReportRequest;
use App\Http\Requests\Reports\MonthlyReportRequest;
use App\Http\Requests\Reports\PdfExportRequest;
use App\Http\Requests\Reports\ShowCashSessionReportRequest;
use App\Http\Requests\Reports\TodayReportRequest;
use App\Models\CashRegisterSession;
use App\Models\FiscalSetting;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
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

    public function today(TodayReportRequest $request, TodayReportService $reports): JsonResponse
    {
        return response()->json([
            'data' => $reports->report(user: $request->user()),
        ]);
    }

    public function executive(ExecutiveReportRequest $request, ExecutiveReportService $reports): JsonResponse
    {
        return response()->json([
            'data' => $reports->report($request->authorizedFilters(), $request->user()),
        ]);
    }

    public function daily(DailyReportRequest $request, DailyReportService $reports): JsonResponse
    {
        return response()->json([
            'data' => $reports->report($request->reportDate()),
        ]);
    }

    public function monthly(MonthlyReportRequest $request, MonthlyReportService $reports): JsonResponse
    {
        return response()->json([
            'data' => $reports->report($request->reportMonth()),
        ]);
    }

    public function income(DateRangeReportRequest $request, IncomeReportService $reports): JsonResponse
    {
        return response()->json([
            'data' => $reports->report($request->authorizedFilters()),
        ]);
    }

    public function categories(DateRangeReportRequest $request, CategoryReportService $reports): JsonResponse
    {
        return response()->json([
            'data' => $reports->report($request->authorizedFilters()),
        ]);
    }

    public function areas(DateRangeReportRequest $request, AreaIncomeReportService $reports): JsonResponse
    {
        return response()->json([
            'data' => $reports->report($request->authorizedFilters()),
        ]);
    }

    public function services(DateRangeReportRequest $request, ServiceSalesReportService $reports): JsonResponse
    {
        return response()->json([
            'data' => $reports->report($request->authorizedFilters()),
        ]);
    }

    public function operations(DateRangeReportRequest $request, OperationsReportService $reports): JsonResponse
    {
        abort_unless($request->user()?->can('audit.view') === true, 403);

        return response()->json([
            'data' => $reports->report($request->authorizedFilters(), $request->user()->can('backups.view')),
        ]);
    }

    public function export(
        ExportReportRequest $request,
        IncomeReportService $incomeReports,
        CategoryReportService $categoryReports,
        AreaIncomeReportService $areaReports,
        ServiceSalesReportService $serviceReports,
        OperationsReportService $operationReports,
        CashSessionReportService $cashSessionReports,
    ): StreamedResponse {
        $filters = $request->authorizedFilters();
        $income = $incomeReports->report($filters);
        $categories = $categoryReports->report($filters);
        $areas = $areaReports->report($filters);
        $services = $serviceReports->report($filters);
        $operations = $this->operationsForExport($operationReports, $filters, $request->user());
        $cashSessionReport = null;

        if (! empty($filters['cash_session_id'])) {
            $cashSession = CashRegisterSession::query()->findOrFail((int) $filters['cash_session_id']);
            $cashSessionReport = $cashSessionReports->report($cashSession);
        }

        $excelService = new PremiumExcelExportService;
        $spreadsheet = $excelService->generate(
            $income,
            $categories,
            $areas,
            $services,
            $operations,
            Carbon::parse($request->dateFrom()),
            Carbon::parse($request->dateTo()),
            $cashSessionReport
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

    public function pdfExport(
        PdfExportRequest $request,
        DailyReportService $dailyReports,
        IncomeReportService $incomeReports,
        CategoryReportService $categoryReports,
        AreaIncomeReportService $areaReports,
        ServiceSalesReportService $servicesReports,
        OperationsReportService $operationsReports,
        CashSessionReportService $cashSessionReports,
        PdfExportService $pdfService
    ): Response {
        $fiscal = FiscalSetting::first() ?? new FiscalSetting([
            'hospital_name' => 'Hospital Local',
            'rtn' => 'N/A',
        ]);

        if ($request->isDailyClosure()) {
            $date = $request->reportDate();
            $data = $dailyReports->report($date);

            $pdf = $pdfService->generateDailyClosurePdf($data, $fiscal->toArray());

            return response($pdf, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'attachment; filename="cierre_diario_'.$date.'.pdf"',
            ]);
        }

        $filters = $request->authorizedReportFilters();

        $income = $incomeReports->report($filters);
        $categories = $categoryReports->report($filters);
        $areas = $areaReports->report($filters);
        $services = $servicesReports->report($filters);
        $operations = $this->operationsForExport($operationsReports, $filters, $request->user());
        $cashSessionReport = null;

        if (! empty($filters['cash_session_id'])) {
            $cashSession = CashRegisterSession::query()->findOrFail((int) $filters['cash_session_id']);
            $cashSessionReport = $cashSessionReports->report($cashSession);
        }

        $pdf = $pdfService->generateRangeClosurePdf([
            'income' => $income,
            'categories' => $categories,
            'areas' => $areas,
            'services' => $services,
            'operations' => $operations,
            'cash_session_report' => $cashSessionReport,
            'filters' => $filters,
            'date_from' => $filters['date_from'],
            'date_to' => $filters['date_to'],
        ], $fiscal->toArray());

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="cierre_periodo_'.$filters['date_from'].'_a_'.$filters['date_to'].'.pdf"',
        ]);
    }

    public function cashSession(
        ShowCashSessionReportRequest $request,
        CashRegisterSession $cashSession,
        CashSessionReportService $reports,
    ): JsonResponse {
        return response()->json([
            'data' => $reports->report($cashSession),
        ]);
    }

    public function executivePdf(
        ExecutivePdfExportRequest $request,
        ExecutiveReportService $reports,
        ExecutivePdfExportService $pdfService,
    ): Response {
        $report = $reports->report($request->authorizedFilters(), $request->user());

        $fiscal = FiscalSetting::first() ?? new FiscalSetting([
            'hospital_name' => 'Hospital San Isidro',
            'rtn' => 'N/A',
            'address' => '',
        ]);

        $pdf = $pdfService->generate(
            $report,
            $fiscal->toArray(),
            $request->user()?->name,
            Carbon::now('America/Tegucigalpa'),
        );

        $filename = sprintf(
            'reporte-ejecutivo-%s-a-%s.pdf',
            $request->dateFrom(),
            $request->dateTo(),
        );

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    public function executiveExcel(
        ExecutivePdfExportRequest $request,
        ExecutiveReportService $reports,
        ExecutiveExcelExportService $excelService,
    ): StreamedResponse {
        $report = $reports->report($request->authorizedFilters(), $request->user());

        $fiscal = FiscalSetting::first() ?? new FiscalSetting([
            'hospital_name' => 'Hospital San Isidro',
            'rtn' => 'N/A',
            'address' => '',
        ]);

        $spreadsheet = $excelService->generate(
            $report,
            $fiscal->toArray(),
            Carbon::createFromFormat('Y-m-d', $request->dateFrom()),
            Carbon::createFromFormat('Y-m-d', $request->dateTo()),
            $request->user()?->name,
        );

        $writer = new Xlsx($spreadsheet);
        $writer->setIncludeCharts(false);
        $filename = sprintf(
            'reporte-ejecutivo-%s-a-%s.xlsx',
            $request->dateFrom(),
            $request->dateTo(),
        );

        return response()->streamDownload(function () use ($writer): void {
            $writer->save('php://output');
        }, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Cache-Control' => 'max-age=0',
        ]);
    }

    /**
     * @param  array{date_from: string, date_to: string, cash_session_id?: int|string, user_id?: int|string, category_id?: int|string, area_id?: int|string, method?: string, status?: string}  $filters
     * @return array<string, mixed>
     */
    private function operationsForExport(OperationsReportService $reports, array $filters, ?User $user): array
    {
        $operations = $reports->report($filters, $user?->can('backups.view') === true);

        if ($user?->can('audit.view') === true) {
            $operations['can_view_audit'] = true;

            return $operations;
        }

        return $this->redactAuditOperations($operations);
    }

    /**
     * @param  array<string, mixed>  $operations
     * @return array<string, mixed>
     */
    private function redactAuditOperations(array $operations): array
    {
        $operations['can_view_audit'] = false;
        $operations['summary'] = array_merge($operations['summary'] ?? [], [
            'void_count' => 0,
            'reprint_count' => 0,
            'audit_event_count' => 0,
            'service_change_count' => 0,
            'payment_void_count' => 0,
            'backup_count' => 0,
            'failed_backup_count' => 0,
        ]);

        foreach (['voids', 'reprints', 'catalog_changes', 'payment_voids', 'backups'] as $key) {
            $operations[$key] = [];
        }

        return $operations;
    }
}
