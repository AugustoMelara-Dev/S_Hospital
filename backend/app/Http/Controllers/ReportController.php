<?php

namespace App\Http\Controllers;

use App\Actions\Reports\AreaIncomeReportService;
use App\Actions\Reports\CashSessionReportService;
use App\Actions\Reports\CategoryReportService;
use App\Actions\Reports\DailyReportService;
use App\Actions\Reports\DashboardReportService;
use App\Actions\Reports\IncomeReportService;
use App\Actions\Reports\MonthlyReportService;
use App\Actions\Reports\OperationsReportService;
use App\Actions\Reports\PdfExportService;
use App\Actions\Reports\PremiumExcelExportService;
use App\Actions\Reports\ServiceSalesReportService;
use App\Http\Requests\Reports\DailyReportRequest;
use App\Http\Requests\Reports\DashboardReportRequest;
use App\Http\Requests\Reports\DateRangeReportRequest;
use App\Http\Requests\Reports\MonthlyReportRequest;
use App\Models\CashRegisterSession;
use App\Models\FiscalSetting;
use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
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

    public function monthly(MonthlyReportRequest $request, MonthlyReportService $reports): JsonResponse
    {
        return response()->json([
            'data' => $reports->report($request->reportMonth()),
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

    public function areas(DateRangeReportRequest $request, AreaIncomeReportService $reports): JsonResponse
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
        AreaIncomeReportService $areaReports,
        ServiceSalesReportService $serviceReports,
        OperationsReportService $operationReports,
    ): StreamedResponse {
        $request->user()->can('reports.export') || abort(403);
        ($request->user()->can('reports.managerial.view') || $request->user()->can('reports.cash_session.view')) || abort(403);

        $filters = $this->scopedFilters($request);
        $income = $incomeReports->report($filters);
        $categories = $categoryReports->report($filters);
        $areas = $areaReports->report($filters);
        $services = $serviceReports->report($filters);
        $operations = $operationReports->report($filters, $request->user()->can('backups.view'));

        $excelService = new PremiumExcelExportService;
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
        Request $request,
        DailyReportService $dailyReports,
        IncomeReportService $incomeReports,
        CategoryReportService $categoryReports,
        AreaIncomeReportService $areaReports,
        ServiceSalesReportService $servicesReports,
        OperationsReportService $operationsReports,
        PdfExportService $pdfService
    ) {
        $request->user()->can('reports.export') || abort(403);
        ($request->user()->can('reports.managerial.view') || $request->user()->can('reports.cash_session.view')) || abort(403);

        $fiscal = FiscalSetting::first() ?? new FiscalSetting([
            'hospital_name' => 'Hospital Local',
            'rtn' => 'N/A',
        ]);

        if ($request->filled('date') || (! $request->filled('date_from') && ! $request->filled('date_to'))) {
            $date = $request->input('date', now()->toDateString());
            $data = $dailyReports->report($date);

            $pdf = $pdfService->generateDailyClosurePdf($data, $fiscal->toArray());

            return response($pdf, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'attachment; filename="cierre_diario_'.$date.'.pdf"',
            ]);
        }

        $dateFromForLimit = is_string($request->input('date_from')) && preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $request->input('date_from'))
            ? Carbon::parse((string) $request->input('date_from'))->addDays(DateRangeReportRequest::MAX_RANGE_DAYS - 1)->toDateString()
            : '9999-12-31';

        $request->validate([
            'date_from' => ['required', 'date_format:Y-m-d'],
            'date_to' => [
                'required',
                'date_format:Y-m-d',
                'after_or_equal:date_from',
                'before_or_equal:'.$dateFromForLimit,
            ],
            'cash_session_id' => ['sometimes', 'integer', 'exists:cash_register_sessions,id'],
            'user_id' => ['sometimes', 'integer', 'exists:users,id'],
            'category_id' => ['sometimes', 'integer', 'exists:categories,id'],
            'area_id' => ['sometimes', 'integer', 'exists:areas,id'],
            'method' => ['sometimes', Rule::in(Payment::METHODS)],
            'status' => ['sometimes', Rule::in([
                Invoice::STATUS_ISSUED,
                Invoice::STATUS_PARTIAL,
                Invoice::STATUS_PAID,
                Invoice::STATUS_VOID,
            ])],
        ]);

        $filters = [
            'date_from' => $request->input('date_from'),
            'date_to' => $request->input('date_to'),
            'cash_session_id' => $request->input('cash_session_id'),
            'user_id' => $request->input('user_id'),
            'category_id' => $request->input('category_id'),
            'area_id' => $request->input('area_id'),
            'method' => $request->input('method'),
            'status' => $request->input('status'),
        ];

        if (! $request->user()->can('reports.managerial.view')) {
            abort_if(empty($filters['cash_session_id']), 403);

            if (! empty($filters['cash_session_id'])) {
                $exists = CashRegisterSession::query()
                    ->whereKey($filters['cash_session_id'])
                    ->where('user_id', $request->user()->id)
                    ->exists();
                if (! $exists) {
                    abort(403);
                }
            }
            $filters['user_id'] = $request->user()->id;
        }

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
            'date_from' => $filters['date_from'],
            'date_to' => $filters['date_to'],
        ], $fiscal->toArray());

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="cierre_periodo_'.$filters['date_from'].'_a_'.$filters['date_to'].'.pdf"',
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
