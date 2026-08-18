import { isReadyStatus } from "@/lib/services/entities";

/**
 * Where the business's treasury wallet address comes from.
 *
 * `GET /v1/dashboard/summary` carries it on `totals.wallet_address` and was
 * the only source the send flow read. That endpoint aggregates a lot and can
 * fail on its own — when it 500s, `wallet_address` is simply undefined, and
 * the flow concluded the business had no treasury wallet at all and said so.
 * It is the wrong conclusion and an alarming thing to tell someone: the
 * wallet exists, we just couldn't load that one response.
 *
 * A ready USDC stablecoin account carries the same address and is fetched
 * independently, so it stands in when summary is unavailable. The deposit
 * flow already preferred it; this makes the precedence shared rather than
 * duplicated in one branch of one handler.
 */
export type TreasuryWalletSources = {
  /** `summary.totals.wallet_address` — undefined when summary failed. */
  summaryWallet?: string | null;
  /** Stablecoin accounts from `GET /v1/entities/{id}/accounts`. */
  stablecoinAccounts?: { status?: string | null; currency?: string | null; walletAddress?: string | null }[] | null;
};

function clean(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * The treasury address to use, or null when we genuinely have none.
 *
 * Summary wins when present — it is the canonical field. A ready USDC
 * account's address is the fallback. Accounts that are not ready are ignored:
 * an address on a pending account may not be able to receive yet, and sending
 * a refund address that cannot receive is worse than failing the quote.
 */
export function resolveTreasuryWalletAddress(sources: TreasuryWalletSources): string | null {
  const fromSummary = clean(sources.summaryWallet);
  if (fromSummary) return fromSummary;

  for (const account of sources.stablecoinAccounts ?? []) {
    if (!isReadyStatus(account?.status)) continue;
    if ((account?.currency || "").trim().toUpperCase() !== "USDC") continue;
    const address = clean(account?.walletAddress);
    if (address) return address;
  }
  return null;
}

/**
 * Why no address was found, so the UI can tell a transient outage apart from
 * an unprovisioned account. Only ever called once resolve returned null.
 *
 * `summaryFailed` means the request errored — not merely that it is still in
 * flight, which callers handle by waiting rather than by erroring.
 */
export function describeMissingTreasuryWallet(summaryFailed: boolean): string {
  if (summaryFailed) {
    return "We couldn't load your account details just now, so this payment can't be priced. Try again in a moment.";
  }
  return "No treasury wallet is provisioned for this business yet.";
}
