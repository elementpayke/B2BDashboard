import { apiEnvelope } from "@/lib/apiClient";

// Only the read side is wired this pass — the KYB submission flow (business
// type, registered address, associates/UBOs, document upload) is a large
// multi-step wizard that doesn't fit the dashboard's existing simple
// "upload 3 documents" modal. That modal stays simulated; see
// docs/api-contract.md for the follow-up.
export type KybStatus = "pending" | "submitted" | "approved" | "rejected" | "expired";

export type KybProfile = {
  kyb_status?: KybStatus;
  [key: string]: unknown;
};

export type KybSummary = { profile: KybProfile | null };

export const kybApi = {
  summary: (businessId: number) => apiEnvelope<KybSummary>("GET", `/businesses/${businessId}/kyb`),
};
