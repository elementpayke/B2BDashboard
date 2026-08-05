import { apiEnvelope } from "@/lib/apiClient";

export type DashboardTotals = {
  money_in_30d: string;
  money_out_30d: string;
  pending_count: number;
  user_balance: unknown;
  wallet_address: string | null;
};

export type ExchangeRates = {
  base: string;
  rates: Record<string, number>;
};

export type DashboardSummary = {
  totals: DashboardTotals;
  fx_rates: ExchangeRates;
};

export const dashboardApi = {
  summary: () => apiEnvelope<DashboardSummary>("GET", "/v1/dashboard/summary"),
};
