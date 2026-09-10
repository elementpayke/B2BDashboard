import { apiEnvelope } from "@/lib/apiClient";

export type AfricaFund = {
  id: string;
  status: string;
  onramp_merchant_order_id?: number | null;
  stable_account_id: string;
  stable_currency: string;
  fiat_account_id: string;
  fiat_currency: string;
  source_currency?: string | null;
  source_amount?: string | null;
  stable_amount?: string | null;
  fiat_amount?: string | null;
  conversion_id?: string | null;
  failure_reason?: string | null;
};

export type AfricaFundCreateIn = {
  destination_account_id: string;
  stable_account_id: string;
  onramp_merchant_order_id: number;
  source_currency?: string;
  source_amount?: number | string;
  stable_currency?: "USDC" | "USDT";
};

export const fundsApi = {
  registerAfricaToFiat: (payload: AfricaFundCreateIn) =>
    apiEnvelope<AfricaFund>("POST", "/v1/funds/africa-to-fiat", payload),
  get: (fundId: string) => apiEnvelope<AfricaFund>("GET", `/v1/funds/${fundId}`),
};

export function isAfricaFundProcessing(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase();
  return ["created", "onramp_processing", "awaiting_stable", "converting"].includes(s);
}

export function isAfricaFundTerminal(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase();
  return ["completed", "failed", "partial"].includes(s);
}
