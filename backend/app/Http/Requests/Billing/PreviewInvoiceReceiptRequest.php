<?php

namespace App\Http\Requests\Billing;

/**
 * The operational receipt draft validates the exact emission payload, including
 * the required patient name. Authorization and normalization are inherited from
 * StoreInvoiceRequest so preview and emission cannot drift.
 */
class PreviewInvoiceReceiptRequest extends StoreInvoiceRequest {}
