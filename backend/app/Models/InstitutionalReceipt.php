<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use LogicException;

/**
 * @property int $id
 * @property int|null $invoice_id
 * @property int|null $payment_id
 * @property int $cash_session_id
 * @property int $series_id
 * @property int $receipt_number
 * @property string $receipt_number_full
 * @property string $status
 * @property string $amount
 * @property int $amount_cents
 * @property Carbon|null $issued_at
 * @property int $issued_by
 * @property string $payer_name
 * @property string $concept
 * @property string $amount_words
 * @property string $template_code
 * @property string $print_profile_code
 * @property string $copy_mode
 * @property array<string, mixed> $institution_snapshot
 * @property array<string, mixed> $series_snapshot
 * @property array<string, mixed> $profile_snapshot
 * @property array<string, mixed>|null $invoice_snapshot
 * @property array<string, mixed>|null $payment_snapshot
 * @property array<int, array<string, mixed>> $items_snapshot
 * @property string|null $pdf_disk
 * @property string|null $pdf_path
 * @property string|null $pdf_sha256
 * @property int $reprint_count
 * @property int|null $voided_by
 * @property Carbon|null $voided_at
 * @property string|null $void_reason
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Collection<int, InstitutionalReceiptPrintEvent> $printEvents
 */
class InstitutionalReceipt extends Model
{
    public const STATUS_ISSUED = 'issued';

    public const STATUS_VOID = 'void';

    protected $fillable = [
        'invoice_id',
        'payment_id',
        'cash_session_id',
        'series_id',
        'receipt_number',
        'receipt_number_full',
        'status',
        'amount',
        'amount_cents',
        'issued_at',
        'issued_by',
        'payer_name',
        'concept',
        'amount_words',
        'template_code',
        'print_profile_code',
        'copy_mode',
        'institution_snapshot',
        'series_snapshot',
        'profile_snapshot',
        'invoice_snapshot',
        'payment_snapshot',
        'items_snapshot',
        'pdf_disk',
        'pdf_path',
        'pdf_sha256',
        'reprint_count',
        'voided_by',
        'voided_at',
        'void_reason',
    ];

    protected static function booted(): void
    {
        static::deleting(function (): never {
            throw new LogicException('Los recibos institucionales emitidos no se eliminan; deben anularse con motivo y auditoria.');
        });
    }

    protected function casts(): array
    {
        return [
            'receipt_number' => 'integer',
            'amount' => 'decimal:2',
            'amount_cents' => 'integer',
            'issued_at' => 'datetime',
            'institution_snapshot' => 'array',
            'series_snapshot' => 'array',
            'profile_snapshot' => 'array',
            'invoice_snapshot' => 'array',
            'payment_snapshot' => 'array',
            'items_snapshot' => 'array',
            'reprint_count' => 'integer',
            'voided_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Invoice, $this> */
    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    /** @return BelongsTo<Payment, $this> */
    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    /** @return BelongsTo<CashRegisterSession, $this> */
    public function cashSession(): BelongsTo
    {
        return $this->belongsTo(CashRegisterSession::class, 'cash_session_id');
    }

    /** @return BelongsTo<InstitutionalReceiptSeries, $this> */
    public function series(): BelongsTo
    {
        return $this->belongsTo(InstitutionalReceiptSeries::class, 'series_id');
    }

    /** @return BelongsTo<User, $this> */
    public function issuer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'issued_by');
    }

    /** @return BelongsTo<User, $this> */
    public function voidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'voided_by');
    }

    /** @return BelongsTo<ReceiptPrintProfile, $this> */
    public function printProfile(): BelongsTo
    {
        return $this->belongsTo(ReceiptPrintProfile::class, 'print_profile_code', 'code');
    }

    /** @return HasMany<InstitutionalReceiptPrintEvent, $this> */
    public function printEvents(): HasMany
    {
        return $this->hasMany(InstitutionalReceiptPrintEvent::class);
    }
}
