# Changes Log — Worker M3 (Receipts & Operation History)

## 1. `frontend/src/features/invoices/history/InvoiceHistoryActionDialogs.tsx`
- **Rationale**: Support comprehensive testing and full operation of all history action dialogs, including passing `invoice` and `reason` to confirmation callbacks, and integrating the balance payment collection dialog (`PaymentModal`).
- **Modifications**:
  - Imported `Payment` type from `../../../lib/api` and `PaymentModal` from `../components/PaymentModal`.
  - Updated `onConfirmVoid` and `onConfirmReverse` signatures to optionally receive `(invoice?: Invoice | null, reason?: string) => void`.
  - Added optional payment collection props to `InvoiceHistoryActionDialogsProps`: `confirmingPayment`, `collectingPayment`, `collectionAmount`, `collectionMethod`, `collectionReference`, `collectionError`, `onPaymentMethodChange`, `onPaymentAmountChange`, `onPaymentReferenceChange`, `onCancelPayment`, and `onConfirmPayment`.
  - Updated `onConfirm` for void dialog to pass `invoice, voidReason`.
  - Updated `onConfirm` for reverse dialog to pass `invoice, reverseReason`.
  - Rendered `PaymentModal` conditionally when `confirmingPayment && invoice`.

## 2. `frontend/src/features/invoices/history/InvoiceHistoryActionDialogs.test.tsx` (New File)
- **Rationale**: Fulfill testing gap identified in Milestone M3 for Void, Reverse, Payment Collection, and Reprint dialogs with reason length validation.
- **Modifications**:
  - Created 21 unit tests covering:
    - **Void Dialog (6 tests)**:
      - Renders invoice details, reason textarea and disables confirm when reason < 5 characters.
      - Enables confirm button when reason has >= 5 characters and triggers `onConfirmVoid(sampleInvoice, reason)`.
      - Triggers `onVoidReasonChange` when typing into textarea.
      - Triggers `onCancelVoid` when clicking cancel button.
      - Disables controls and shows "Anulando..." when `voidingInvoice=true`.
      - Displays `voidReasonError` message with `role="alert"`.
    - **Reverse Dialog (6 tests)**:
      - Renders warning about cashbox refund movements and disables confirm when reason < 5 characters.
      - Enables confirm button when reason has >= 5 characters and triggers `onConfirmReverse(sampleInvoice, reason)`.
      - Triggers `onReverseReasonChange` when typing into textarea.
      - Triggers `onCancelReverse` when clicking cancel button.
      - Disables controls and shows "Reversando..." when `reversingInvoice=true`.
      - Displays `reverseReasonError` message with `role="alert"`.
    - **Payment Collection Dialog (7 tests)**:
      - Renders balance display (`balance_due`), invoice number and patient name.
      - Allows payment method selection (cash, card, transfer) and triggers `onPaymentMethodChange`.
      - Allows editing payment amount and triggers `onPaymentAmountChange`.
      - Calls `onConfirmPayment` with amount on submission.
      - Disables submit button when `collectingPayment=true`.
      - Displays `collectionError` message with `role="alert"`.
      - Calls `onCancelPayment` when closing dialog.
    - **Reprint Dialog (2 tests)**:
      - Enforces min 5 characters reason validation for receipt reprint.
      - Enables confirm button and calls `onConfirmReprint(reason)` when reason >= 5 characters.

## 3. `frontend/e2e/recibos-flow.spec.ts`
- **Rationale**: Resolve 2 failing E2E tests caused by outdated currency formatting assertion and empty mock preview HTML markup.
- **Modifications**:
  - Line 132-152: Updated mock route for `/api/institutional-receipts/**/pdf` to return valid institutional receipt HTML containing `<section class="receipt-page">` with `<span class="chip">ORIGINAL</span>`, enabling `summarizeReceiptDocument` to parse 1 valid exemplar and render the preview iframe cleanly.
  - Line 157 (renumbered to line 173): Corrected currency format expectation from `"L 250.00"` to canonical `"L. 250.00"` (with period and space per Feature 4 canonical token rules).
