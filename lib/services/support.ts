import { apiEnvelope } from "@/lib/apiClient";

export const SUPPORT_CATEGORIES = [
  { key: "payout", label: "Payout" },
  { key: "deposit", label: "Deposit / top-up" },
  { key: "account", label: "Account" },
  { key: "kyb", label: "Verification" },
  { key: "cards", label: "Cards" },
  { key: "api", label: "API / developers" },
  { key: "other", label: "Other" },
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]["key"];

export type SupportIssueInput = {
  category: SupportCategory;
  message: string;
  screen?: string | null;
  reference_id?: string | null;
};

export type SupportIssueResult = {
  reference: string;
};

export function isSupportCategory(value: string): value is SupportCategory {
  return SUPPORT_CATEGORIES.some((c) => c.key === value);
}

export async function submitSupportIssue(
  input: SupportIssueInput,
): Promise<SupportIssueResult> {
  return apiEnvelope<SupportIssueResult>("POST", "/v1/support/issues", {
    category: input.category,
    message: input.message.trim(),
    screen: input.screen?.trim() || null,
    reference_id: input.reference_id?.trim() || null,
  });
}
