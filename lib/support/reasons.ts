/**
 * Canonical support reasons shared with the API contract.
 *
 * The server stores the stable `id`; the exact English `label` is kept for
 * compatibility with the legacy label-based API. Public labels are translated
 * from `messages/<locale>/support.json` under `reason.<key>`.
 */
export const SUPPORT_REASONS = [
  { id: "booking", key: "booking", label: "Booking" },
  { id: "project_creation", key: "projectCreation", label: "Project creation" },
  { id: "customer", key: "customer", label: "Customer" },
  { id: "payment_payout", key: "paymentPayout", label: "Payment / payout" },
  { id: "cancellation", key: "cancellation", label: "Cancellation" },
  { id: "dispute", key: "dispute", label: "Dispute" },
  { id: "warranty_complaint", key: "warrantyComplaint", label: "Warranty / complaint" },
  { id: "account_profile", key: "accountProfile", label: "Account / profile" },
  { id: "verification_documents", key: "verificationDocuments", label: "Verification / documents" },
  { id: "services_pricing", key: "servicesPricing", label: "Services & pricing" },
  { id: "availability_service_area", key: "availabilityServiceArea", label: "Availability / service area" },
  { id: "technical_problem", key: "technicalProblem", label: "Technical problem" },
  { id: "other", key: "other", label: "Other" },
] as const;

export type SupportReason = (typeof SUPPORT_REASONS)[number];
export type SupportReasonId = SupportReason["id"];
export type SupportReasonKey = SupportReason["key"];

export const SUPPORT_REASON_IDS: readonly SupportReasonId[] = SUPPORT_REASONS.map(
  (reason) => reason.id,
);

const REASON_BY_ID = new Map<string, SupportReason>(
  SUPPORT_REASONS.map((reason) => [reason.id, reason]),
);
const REASON_BY_KEY = new Map<string, SupportReason>(
  SUPPORT_REASONS.map((reason) => [reason.key, reason]),
);
const REASON_BY_LABEL = new Map<string, SupportReason>(
  SUPPORT_REASONS.map((reason) => [reason.label.toLowerCase(), reason]),
);

export type ServerSupportReason = { id: string; label?: string };

export interface SupportReasonOption {
  id: string;
  key: SupportReasonKey | null;
  label: string;
}

export function supportReasonFor(
  value: string | null | undefined,
): SupportReason | undefined {
  if (!value) return undefined;
  return (
    REASON_BY_ID.get(value) ||
    REASON_BY_KEY.get(value) ||
    REASON_BY_LABEL.get(value.trim().toLowerCase())
  );
}

export function supportReasonKey(
  value: string | null | undefined,
): SupportReasonKey | null {
  return supportReasonFor(value)?.key ?? null;
}

export function supportReasonLabel(
  value: string | null | undefined,
  fallbackLabel?: string | null,
): string {
  return supportReasonFor(value)?.label || fallbackLabel || value || "";
}

/**
 * Builds the dropdown in the canonical order, merges labels returned by the
 * API, and appends any future server reason instead of silently dropping it.
 * The stable IDs are always preserved for submission.
 */
export function buildSupportReasonOptions(
  serverReasons?: readonly ServerSupportReason[] | null,
): SupportReasonOption[] {
  const serverById = new Map(
    (serverReasons || [])
      .filter((reason): reason is ServerSupportReason => Boolean(reason?.id))
      .map((reason) => [reason.id, reason]),
  );
  const options: SupportReasonOption[] = SUPPORT_REASONS.map((reason) => ({
    id: reason.id,
    key: reason.key,
    label: serverById.get(reason.id)?.label || reason.label,
  }));
  for (const reason of serverReasons || []) {
    if (!reason?.id || REASON_BY_ID.has(reason.id)) continue;
    options.push({
      id: reason.id,
      key: null,
      label: reason.label || reason.id,
    });
  }
  return options;
}
