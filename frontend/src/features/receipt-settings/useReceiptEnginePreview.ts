import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

/**
 * Draft-only profile fields accepted by the backend `/test-preview` endpoint.
 * The advanced geometry/typography fields require `receipt_settings.advanced`
 * and are only sent by callers that hold it.
 */
export type ReceiptEngineDraft = {
  copies_mode?: 'original_only' | 'original_first' | 'original_first_second';
  show_copy_legend?: boolean;
  show_physical_seal_space?: boolean;
  use_logo?: boolean;
  active?: boolean;
  is_global_default?: boolean;
  paper_kind?: string;
  orientation?: 'landscape' | 'portrait';
  width_mm?: string;
  height_mm?: string;
  margin_top_mm?: string;
  margin_right_mm?: string;
  margin_bottom_mm?: string;
  margin_left_mm?: string;
  font_family?: string;
  font_scale?: string;
  show_technical_fields?: boolean;
};

export type ReceiptEnginePreview = {
  html: string;
  copy_labels?: string[];
  copy_count?: number;
  reserved_number?: boolean;
  next_receipt_number?: number | null;
  draft_applied?: boolean;
  watermark?: string;
  /**
   * Canonical, typed result of the generator (C3-P2). Every surface that talks
   * about pages, copies or composition must read THIS instead of deriving pages
   * from `copy_count`: two destinations can share one page, and a long operation
   * can need extra pages. `page_count` is measured on the generated document.
   */
  document?: ReceiptDocumentPlan;
};

export type ReceiptDocumentPaper = {
  kind: string;
  label: string;
  orientation: string;
  width_pt: number;
  height_pt: number;
};

export type ReceiptDocumentCopies = {
  count: number;
  labels: string[];
  destinations: string[];
};

export type ReceiptDocumentDistributionEntry = {
  sheet: number;
  destinations: string[];
  pages: number;
};

export type ReceiptComposition = 'single' | 'paired';

export type ReceiptDocumentPlan = {
  paper: ReceiptDocumentPaper;
  copies: ReceiptDocumentCopies;
  /** Real PDF pages of the generated document, measured by the engine. */
  page_count: number;
  sheet_count: number;
  requested_composition: ReceiptComposition;
  used_composition: ReceiptComposition;
  distribution: ReceiptDocumentDistributionEntry[];
  alternative_output: boolean;
  alternative_reason: string | null;
  draft: boolean;
  /** Human line describing the composed document (server text). */
  headline: string;
  /** Instruction for the system print dialog (server text). */
  print_instruction: string;
  /** Explicit one-face assumption, or null when no physical sheet is claimed. */
  sheet_assumption: string | null;
};

/**
 * Synthetic sample for the draft preview. It is clearly sample data; the
 * document is watermarked "PRUEBA - SIN VALIDEZ" by the engine and the next
 * number is shown but never consumed.
 */
export const RECEIPT_PREVIEW_SAMPLE = {
  payerName: 'Paciente de prueba',
  concept: 'Servicios hospitalarios de prueba',
  amount: '25.00',
} as const;

/**
 * Stable signature of a draft. Two renders with the same values produce the same
 * key, so TanStack Query reuses the cached engine response. The key includes the
 * signature, which is what prevents an older draft's response from replacing a
 * newer preview: the component only reads the data for the current key, and no
 * placeholder data is configured.
 */
export function receiptDraftSignature(draft: ReceiptEngineDraft | null | undefined): string {
  if (!draft) return 'persisted';

  const ordered: Record<string, unknown> = {};
  for (const key of Object.keys(draft).sort()) {
    const value = draft[key as keyof ReceiptEngineDraft];
    if (value !== undefined) {
      ordered[key] = value;
    }
  }

  return JSON.stringify(ordered);
}

export function receiptEnginePreviewQueryKey(
  profileCode: string | null,
  draftSignature: string = 'persisted',
) {
  return ['receipt-settings-engine-preview', profileCode ?? 'none', draftSignature] as const;
}

/**
 * Real engine preview. The backend endpoint renders the same blade/Dompdf
 * source as the PDF, reserves no correlativo and records no print event. When a
 * validated draft is provided, the engine renders the DRAFT profile in memory
 * (nothing is persisted); otherwise it renders the stored profile.
 */
export async function requestReceiptEnginePreview(
  profileCode: string,
  draft?: ReceiptEngineDraft,
): Promise<ReceiptEnginePreview> {
  const response = await apiClient.request<{ data: ReceiptEnginePreview }>(
    '/api/settings/institutional-receipts/test-preview',
    {
      method: 'POST',
      body: JSON.stringify({
        profile_code: profileCode,
        payer_name: RECEIPT_PREVIEW_SAMPLE.payerName,
        concept: RECEIPT_PREVIEW_SAMPLE.concept,
        amount: RECEIPT_PREVIEW_SAMPLE.amount,
        ...(draft ? { draft } : {}),
      }),
    },
  );

  return response.data;
}

export function useReceiptEnginePreview({
  profileCode,
  draft = null,
  enabled = true,
}: {
  profileCode: string | null;
  draft?: ReceiptEngineDraft | null;
  enabled?: boolean;
}) {
  const draftSignature = receiptDraftSignature(draft);

  return useQuery({
    queryKey: receiptEnginePreviewQueryKey(profileCode, draftSignature),
    queryFn: () => requestReceiptEnginePreview(profileCode as string, draft ?? undefined),
    enabled: enabled && Boolean(profileCode),
    // The preview must never show a stale document: TanStack only reads the
    // current key (which includes the draft signature), and no placeholder data
    // is kept, so an older in-flight response cannot replace a newer preview.
    staleTime: 0,
    retry: false,
  });
}
