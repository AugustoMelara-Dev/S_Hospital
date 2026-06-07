<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\Reports\AreaIncomeReportService;
use App\Actions\Reports\CashSessionReportService;
use App\Actions\Reports\CategoryReportService;
use App\Actions\Reports\DailyReportService;
use App\Actions\Reports\DashboardReportService;
use App\Actions\Reports\IncomeReportService;
use App\Actions\Reports\InstitutionalExcelExportService;
use App\Actions\Reports\MonthlyReportService;
use App\Actions\Reports\OperationsReportService;
use App\Actions\Reports\PdfExportService;
use App\Actions\Reports\ServiceSalesReportService;
use App\Http\Requests\Reports\DailyReportRequest;
use App\Http\Requests\Reports\DashboardReportRequest;
use App\Http\Requests\Reports\DateRangeReportRequest;
use App\Http\Requests\Reports\ExportReportRequest;
use App\Http\Requests\Reports\MonthlyReportRequest;
use App\Http\Requests\Reports\PdfExportRequest;
use App\Http\Requests\Reports\ShowCashSessionReportRequest;
use App\Models\CashRegisterSession;
use App\Models\FiscalSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\Response;
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
    ): StreamedResponse {
        $filters = $request->authorizedFilters();
        $income = $incomeReports->report($filters);
        $categories = $categoryReports->report($filters);
        $areas = $areaReports->report($filters);
        $services = $serviceReports->report($filters);
        $operations = $operationReports->report($filters, $request->user()->can('backups.view'));

        $excelService = new InstitutionalExcelExportService;
        $spreadsheet = $excelService->generate(
            $income,
            $categories,
            $areas,
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

    public function pdfExport(
        PdfExportRequest $request,
        DailyReportService $dailyReports,
        IncomeReportService $incomeReports,
        CategoryReportService $categoryReports,
        AreaIncomeReportService $areaReports,
        ServiceSalesReportService $servicesReports,
        OperationsReportService $operationsReports,
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
        $operations = $operationsReports->report($filters, $request->user()->can('backups.view'));

        $pdf = $pdfService->generateRangeClosurePdf([
            'income' => $income,
            'categories' => $categories,
            'areas' => $areas,
            'services' => $services,
            'operations' => $operations,
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
}
